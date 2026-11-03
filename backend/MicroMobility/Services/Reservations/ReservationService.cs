using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Exceptions;
using MicroMobility.Helpers;
using MicroMobility.Models;
using MicroMobility.Services.CurrentUser;
using MicroMobility.Services.Realtime;

namespace MicroMobility.Services.Reservations;

public interface IReservationService
{
    /// <summary>The caller's reservations, newest first.</summary>
    Task<IReadOnlyList<ReservationResponse>> ListMineAsync(CancellationToken cancellationToken);

    Task<CreateReservationResponse> CreateAsync(ReservationCreateRequest request, CancellationToken cancellationToken);

    /// <summary>Cancels one of the caller's reservations. Another user's is a 404, as if it did not exist.</summary>
    Task<CancelReservationResponse> CancelAsync(Guid reservationId, CancellationToken cancellationToken);
}

public sealed class ReservationService : IReservationService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IReservationExpiry _expiry;
    private readonly IReservationFreshness _freshness;
    private readonly INotificationNotifier _notifier;
    private readonly ReservationOptions _options;

    public ReservationService(
        AppDbContext db,
        ICurrentUser currentUser,
        IReservationExpiry expiry,
        IReservationFreshness freshness,
        INotificationNotifier notifier,
        IOptions<ReservationOptions> options)
    {
        _db = db;
        _currentUser = currentUser;
        _expiry = expiry;
        _freshness = freshness;
        _notifier = notifier;
        _options = options.Value;
    }

    public async Task<IReadOnlyList<ReservationResponse>> ListMineAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        await _freshness.EnsureFreshAsync(cancellationToken);

        return await _db.Reservations.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReservationResponse(
                r.Id, r.UserId, r.VehicleId, r.Status, r.ReservedAt, r.ExpiresAt, r.CancelledAt, r.CreatedAt,
                new ReservationVehicleResponse(r.VehicleId, null, r.Vehicle.Type, null, r.Vehicle.AvailabilityStatus)))
            .ToListAsync(cancellationToken);
    }

    public async Task<CreateReservationResponse> CreateAsync(
        ReservationCreateRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var vehicleId = Guard.Required(request.VehicleId, "vehicle_id");
        var ttlMinutes = _options.NormalizeTtl(request.MinutesTtl);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var expired = await _expiry.ExpireDueAsync(cancellationToken);

        // Claim with a conditional UPDATE: of two people reserving the same vehicle, exactly one
        // flips it from available to reserved; the other matches no row.
        var claimed = await _db.Vehicles
            .Where(v => v.Id == vehicleId && v.AvailabilityStatus == VehicleAvailabilityStatus.Available)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.AvailabilityStatus, VehicleAvailabilityStatus.Reserved), cancellationToken);
        if (claimed == 0)
        {
            throw new ConflictException("Vehicle is not available for reservation", ErrorCodes.VehicleUnavailable);
        }

        var now = DateTime.UtcNow;
        var reservation = new Reservation
        {
            UserId = userId,
            VehicleId = vehicleId,
            Status = ReservationStatus.Active,
            ReservedAt = now,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(ttlMinutes)
        };
        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _notifier.NotifyReservationsExpiredAsync(expired, cancellationToken);
        await _notifier.NotifyAsync(userId, NotificationEvents.ReservationCreated,
            new ReservationNotificationPayload(reservation.Id, vehicleId, ReservationStatus.Active, reservation.ExpiresAt),
            cancellationToken);

        return new CreateReservationResponse(true, new CreatedReservation(
            reservation.Id, userId, vehicleId, reservation.Status, reservation.CreatedAt, reservation.ExpiresAt));
    }

    public async Task<CancelReservationResponse> CancelAsync(Guid reservationId, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var expired = await _expiry.ExpireDueAsync(cancellationToken);

        var reservation = await _db.Reservations.AsNoTracking()
            .Where(r => r.Id == reservationId && r.UserId == userId)
            .Select(r => new { r.Status, r.VehicleId })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Reservation not found");

        // Captured, not inlined: DateTime.UtcNow inside the expression would become SQL now()
        // (timestamptz), which Postgres will not assign to this `timestamp` column.
        var cancelledAt = DateTime.UtcNow;
        var cancelled = reservation.Status == ReservationStatus.Active
            ? await _db.Reservations
                .Where(r => r.Id == reservationId && r.Status == ReservationStatus.Active)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, ReservationStatus.Cancelled)
                    .SetProperty(r => r.CancelledAt, cancelledAt), cancellationToken)
            : 0;

        var released = cancelled == 1
            ? await _db.Vehicles
                .Where(v => v.Id == reservation.VehicleId && v.AvailabilityStatus == VehicleAvailabilityStatus.Reserved)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.AvailabilityStatus, VehicleAvailabilityStatus.Available), cancellationToken)
            : 0;

        // Lost a race (converted to a ride or expired in between): report what it is now.
        var status = cancelled == 1
            ? ReservationStatus.Cancelled
            : await _db.Reservations.Where(r => r.Id == reservationId).Select(r => r.Status).SingleAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        await _notifier.NotifyReservationsExpiredAsync(expired, cancellationToken);

        if (cancelled == 1)
        {
            await _notifier.NotifyAsync(userId, NotificationEvents.ReservationCancelled,
                new ReservationNotificationPayload(reservationId, reservation.VehicleId, ReservationStatus.Cancelled, null),
                cancellationToken);
        }

        return new CancelReservationResponse(
            true,
            cancelled == 1 ? "Reservation cancelled successfully" : "Reservation already inactive",
            reservationId,
            status,
            released);
    }
}
