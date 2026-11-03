using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Services.Reservations;

namespace MicroMobility.Services.FleetService;

public interface IVehicleService
{
    /// <summary>Available vehicles with a known position (the map).</summary>
    Task<IReadOnlyList<VehicleWithStateResponse>> ListAvailableAsync(CancellationToken cancellationToken);

    /// <summary>Any vehicle by id, whatever its availability. 404 if it does not exist.</summary>
    Task<VehicleWithStateResponse> GetAsync(Guid vehicleId, CancellationToken cancellationToken);
}

public interface IStationService
{
    /// <summary>Active stations with their count of rentable vehicles.</summary>
    Task<IReadOnlyList<StationResponse>> ListActiveAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Active stations with at least one free slot: capacity minus vehicles docked there that are
    /// not out on a started ride. Shown while the user is riding, to pick where to park.
    /// </summary>
    Task<IReadOnlyList<StationResponse>> ListParkingAvailableAsync(CancellationToken cancellationToken);

    /// <summary>Rentable vehicles docked at an active station. 404 if the station is missing or inactive.</summary>
    Task<IReadOnlyList<VehicleWithStateResponse>> ListVehiclesAsync(Guid stationId, CancellationToken cancellationToken);
}

/// <summary>Read-only queries over stations, vehicles and their live state.</summary>
public sealed class FleetService : IVehicleService, IStationService
{
    private readonly AppDbContext _db;
    private readonly IReservationFreshness _freshness;

    public FleetService(AppDbContext db, IReservationFreshness freshness)
    {
        _db = db;
        _freshness = freshness;
    }

    // `model` and `qr_code` are not stored yet; the contract keeps them as null.
    private static readonly Expression<Func<Vehicle, VehicleWithStateResponse>> ToResponse = v =>
        new VehicleWithStateResponse(
            v.CurrentState != null ? v.CurrentState.VehicleId : null,
            v.Id,
            v.CurrentState != null ? v.CurrentState.CurrentBatteryPercent : null,
            v.CurrentState != null ? v.CurrentState.CurrentLat : null,
            v.CurrentState != null ? v.CurrentState.CurrentLng : null,
            v.OperationalStatus,
            v.CurrentState != null ? v.CurrentState.UpdatedAt : null,
            new VehicleSummaryResponse(
                v.Id,
                null,
                v.Type,
                null,
                v.AvailabilityStatus,
                v.CurrentState != null ? v.CurrentState.UpdatedAt : null));

    public async Task<IReadOnlyList<VehicleWithStateResponse>> ListAvailableAsync(CancellationToken cancellationToken)
    {
        await _freshness.EnsureFreshAsync(cancellationToken);
        return await _db.Vehicles.AsNoTracking()
            .Where(v => v.AvailabilityStatus == VehicleAvailabilityStatus.Available
                        && v.CurrentState != null
                        && v.CurrentState.CurrentLat != null
                        && v.CurrentState.CurrentLng != null)
            .Select(ToResponse)
            .ToListAsync(cancellationToken);
    }

    public async Task<VehicleWithStateResponse> GetAsync(Guid vehicleId, CancellationToken cancellationToken)
    {
        await _freshness.EnsureFreshAsync(cancellationToken);
        return await _db.Vehicles.AsNoTracking()
                   .Where(v => v.Id == vehicleId)
                   .Select(ToResponse)
                   .FirstOrDefaultAsync(cancellationToken)
               ?? throw new KeyNotFoundException("Vehicle not found");
    }

    public async Task<IReadOnlyList<StationResponse>> ListActiveAsync(CancellationToken cancellationToken)
    {
        await _freshness.EnsureFreshAsync(cancellationToken);
        return await _db.Stations.AsNoTracking()
            .Where(s => s.Status == StationStatus.Active)
            .OrderBy(s => s.Name)
            .Select(s => new StationResponse(
                s.Id, s.Name, s.Lat, s.Lng, s.Capacity,
                _db.Vehicles.Count(v => v.StationId == s.Id
                                        && v.AvailabilityStatus == VehicleAvailabilityStatus.Available
                                        && v.CurrentState != null
                                        && !_db.Rides.Any(r => r.VehicleId == v.Id && r.Status == RideStatus.Started)),
                null))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StationResponse>> ListParkingAvailableAsync(CancellationToken cancellationToken)
    {
        await _freshness.EnsureFreshAsync(cancellationToken);
        return await _db.Stations.AsNoTracking()
            .Where(s => s.Status == StationStatus.Active)
            .Select(s => new
            {
                Station = s,
                Occupied = _db.Vehicles.Count(v => v.StationId == s.Id
                                                   && !_db.Rides.Any(r => r.VehicleId == v.Id && r.Status == RideStatus.Started))
            })
            .Where(x => x.Station.Capacity > x.Occupied)
            .OrderBy(x => x.Station.Name)
            .Select(x => new StationResponse(
                x.Station.Id, x.Station.Name, x.Station.Lat, x.Station.Lng, x.Station.Capacity,
                0, x.Station.Capacity - x.Occupied))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VehicleWithStateResponse>> ListVehiclesAsync(Guid stationId, CancellationToken cancellationToken)
    {
        await _freshness.EnsureFreshAsync(cancellationToken);

        var stationIsActive = await _db.Stations.AsNoTracking()
            .AnyAsync(s => s.Id == stationId && s.Status == StationStatus.Active, cancellationToken);
        if (!stationIsActive) throw new KeyNotFoundException("Station not found or inactive");

        return await _db.Vehicles.AsNoTracking()
            .Where(v => v.StationId == stationId
                        && v.AvailabilityStatus == VehicleAvailabilityStatus.Available
                        && v.CurrentState != null
                        && !_db.Rides.Any(r => r.VehicleId == v.Id && r.Status == RideStatus.Started))
            .OrderByDescending(v => v.CurrentState!.UpdatedAt)
            .Select(ToResponse)
            .ToListAsync(cancellationToken);
    }
}
