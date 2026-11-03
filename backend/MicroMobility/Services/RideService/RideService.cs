using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Exceptions;
using MicroMobility.Helpers;
using MicroMobility.Models;
using MicroMobility.Services.CurrentUser;
using MicroMobility.Services.Pricing;
using MicroMobility.Services.Realtime;
using MicroMobility.Services.Reservations;

namespace MicroMobility.Services.RideService;

public interface IRideService
{
    /// <summary>The caller's started ride, or null.</summary>
    Task<RideResponse?> GetActiveAsync(CancellationToken cancellationToken);

    /// <summary>The caller's rides, newest first.</summary>
    Task<IReadOnlyList<RideResponse>> ListMineAsync(CancellationToken cancellationToken);

    Task<StartRideResponse> StartAsync(StartRideRequest request, CancellationToken cancellationToken);
    Task<EndRideResponse> EndAsync(EndRideRequest request, CancellationToken cancellationToken);
}

public sealed class RideService : IRideService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IPricingService _pricing;
    private readonly IReservationExpiry _expiry;
    private readonly INotificationNotifier _notifier;

    public RideService(
        AppDbContext db,
        ICurrentUser currentUser,
        IPricingService pricing,
        IReservationExpiry expiry,
        INotificationNotifier notifier)
    {
        _db = db;
        _currentUser = currentUser;
        _pricing = pricing;
        _expiry = expiry;
        _notifier = notifier;
    }

    public async Task<RideResponse?> GetActiveAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var active = await _db.Rides.AsNoTracking()
            .Where(r => r.UserId == userId && r.Status == RideStatus.Started)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => new { Ride = r, r.Vehicle.Type })
            .FirstOrDefaultAsync(cancellationToken);

        return active is null
            ? null
            : RideResponse.FromEntity(active.Ride, new RideVehicleResponse(null, active.Type, null));
    }

    public async Task<IReadOnlyList<RideResponse>> ListMineAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var rides = await _db.Rides.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderBy(r => r.StartedAt == null)           // never-started rides last
            .ThenByDescending(r => r.StartedAt)
            .ToListAsync(cancellationToken);
        return rides.Select(r => RideResponse.FromEntity(r)).ToList();
    }

    public async Task<StartRideResponse> StartAsync(StartRideRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var vehicleId = Guard.Required(request.VehicleId, "vehicle_id");
        var startLat = Guard.Required(request.StartLat, "start_lat");
        var startLng = Guard.Required(request.StartLng, "start_lng");
        var now = DateTime.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var expired = await _expiry.ExpireDueAsync(cancellationToken);

        if (await _db.Rides.AnyAsync(r => r.UserId == userId && r.Status == RideStatus.Started, cancellationToken))
        {
            throw new ConflictException(
                "You already have an active ride. End it before starting another.", ErrorCodes.ActiveRideExists);
        }

        // Row lock: two riders scanning the same vehicle serialize here.
        var vehicle = (await _db.Vehicles
                .FromSql($"SELECT * FROM vehicles WHERE vehicle_id = {vehicleId} FOR UPDATE")
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            .SingleOrDefault() ?? throw new KeyNotFoundException("Vehicle not found");

        var reservation = await _db.Reservations.AsNoTracking()
            .Where(r => r.VehicleId == vehicleId && r.Status == ReservationStatus.Active && r.ExpiresAt > now)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { r.Id, r.UserId })
            .FirstOrDefaultAsync(cancellationToken);

        switch (vehicle.AvailabilityStatus)
        {
            case VehicleAvailabilityStatus.Reserved when reservation is null:
                throw new ConflictException("Vehicle is not available", ErrorCodes.VehicleUnavailable);
            case VehicleAvailabilityStatus.Reserved or VehicleAvailabilityStatus.Available
                when reservation is not null && reservation.UserId != userId:
                throw new ConflictException(
                    "Vehicle is currently reserved by another user", ErrorCodes.VehicleReservedByAnotherUser);
            case VehicleAvailabilityStatus.Reserved or VehicleAvailabilityStatus.Available:
                break;
            default:
                throw new ConflictException("Vehicle is not available", ErrorCodes.VehicleUnavailable);
        }

        var rate = await _pricing.GetRateAsync(PricingRules.KeyFor(vehicle.Type), cancellationToken);

        var ride = new Ride
        {
            UserId = userId,
            VehicleId = vehicleId,
            Status = RideStatus.Started,
            StartedAt = now,
            StartLat = startLat,
            StartLng = startLng,
            InitialFee = rate.InitialFee,
            PricePerMinute = rate.PricePerMinute,
            TotalCost = 0m
        };
        _db.Rides.Add(ride);
        await _db.SaveChangesAsync(cancellationToken);

        // Claim the vehicle only if it is still rentable; anything else rolls the ride back.
        var claimed = await _db.Vehicles
            .Where(v => v.Id == vehicleId
                        && (v.AvailabilityStatus == VehicleAvailabilityStatus.Available
                            || v.AvailabilityStatus == VehicleAvailabilityStatus.Reserved))
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.AvailabilityStatus, VehicleAvailabilityStatus.InUse), cancellationToken);
        if (claimed != 1) throw new ConflictException("Vehicle is not available", ErrorCodes.VehicleUnavailable);

        if (reservation is not null && reservation.UserId == userId)
        {
            await _db.Reservations
                .Where(r => r.Id == reservation.Id && r.Status == ReservationStatus.Active)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReservationStatus.ConvertedToRide), cancellationToken);
        }

        await TouchVehicleStateAsync(vehicleId, now, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _notifier.NotifyReservationsExpiredAsync(expired, cancellationToken);
        await _notifier.NotifyAsync(userId, NotificationEvents.RideStarted,
            new RideNotificationPayload(ride.Id, vehicleId, RideStatus.Started, null), cancellationToken);

        return new StartRideResponse(true, ride.Id, new PricingSnapshot(rate.InitialFee, rate.PricePerMinute));
    }

    public async Task<EndRideResponse> EndAsync(EndRideRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var rideId = Guard.Required(request.RideId, "ride_id");
        var endLat = Guard.Required(request.EndLat, "end_lat");
        var endLng = Guard.Required(request.EndLng, "end_lng");
        var endTime = DateTime.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // Row lock: a double-tapped "End ride" bills once; the second sees a completed ride.
        var ride = (await _db.Rides
                .FromSql($"SELECT * FROM rides WHERE ride_id = {rideId} FOR UPDATE")
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            .SingleOrDefault() ?? throw new KeyNotFoundException("Ride not found");

        if (ride.UserId != userId) throw new UnauthorizedAccessException("Not your ride");
        if (ride.Status is not (RideStatus.Started or RideStatus.Paused))
        {
            throw new ConflictException("Ride has already ended or is not active", ErrorCodes.RideNotActive);
        }

        var startedAt = ride.StartedAt
            ?? throw new InvalidOperationException($"Ride {ride.Id} is active but has no start time.");

        var vehicleType = await _db.Vehicles.AsNoTracking()
            .Where(v => v.Id == ride.VehicleId)
            .Select(v => v.Type)
            .SingleAsync(cancellationToken);

        var bill = await _pricing.CalculateAsync(startedAt, endTime, PricingRules.KeyFor(vehicleType), cancellationToken);
        var totalCost = (decimal)bill.TotalPrice;

        await _db.Rides
            .Where(r => r.Id == ride.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.EndedAt, endTime)
                .SetProperty(r => r.Status, RideStatus.Completed)
                .SetProperty(r => r.EndLat, endLat)
                .SetProperty(r => r.EndLng, endLng)
                .SetProperty(r => r.DurationMinutes, bill.DurationMinutes)
                .SetProperty(r => r.InitialFee, bill.Rate.InitialFee)
                .SetProperty(r => r.PricePerMinute, bill.Rate.PricePerMinute)
                .SetProperty(r => r.TotalCost, totalCost), cancellationToken);

        await _db.Vehicles
            .Where(v => v.Id == ride.VehicleId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.AvailabilityStatus, VehicleAvailabilityStatus.Available), cancellationToken);

        await TouchVehicleStateAsync(ride.VehicleId, endTime, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _notifier.NotifyAsync(userId, NotificationEvents.RideEnded,
            new RideNotificationPayload(ride.Id, ride.VehicleId, RideStatus.Completed, totalCost), cancellationToken);

        return new EndRideResponse(
            true,
            bill.DurationMinutes,
            new PricingSnapshot(bill.Rate.InitialFee, bill.Rate.PricePerMinute),
            bill.TotalPrice);
    }

    private Task<int> TouchVehicleStateAsync(Guid vehicleId, DateTime now, CancellationToken cancellationToken) =>
        _db.VehicleCurrentStates
            .Where(s => s.VehicleId == vehicleId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UpdatedAt, now), cancellationToken);
}
