using System.Text.Json.Serialization;
using MicroMobility.Models;

namespace MicroMobility.DTOs;

public sealed record StartRideRequest(Guid? VehicleId, double? StartLat, double? StartLng);

public sealed record EndRideRequest(Guid? RideId, double? EndLat, double? EndLng);

public sealed record StartRideResponse(bool Ok, Guid RideId, PricingSnapshot Pricing);

public sealed record EndRideResponse(bool Ok, int DurationMinutes, PricingSnapshot Pricing, double TotalPrice);

/// <summary>
/// Every ride column, plus the names the app reads: `start_time`/`end_time` (= started_at/ended_at)
/// and `cost` (= total_cost). `pricing` is omitted when no rate snapshot exists; `vehicles` is only
/// present on the active-ride endpoint.
/// </summary>
public sealed record RideResponse(
    Guid RideId,
    Guid UserId,
    Guid VehicleId,
    Guid? StartStationId,
    Guid? EndStationId,
    RideStatus Status,
    DateTime? StartedAt,
    DateTime? EndedAt,
    DateTime? StartTime,
    DateTime? EndTime,
    double? StartLat,
    double? StartLng,
    double? EndLat,
    double? EndLng,
    double? DistanceMeters,
    int? DurationSeconds,
    int? DurationMinutes,
    decimal TotalCost,
    decimal Cost,
    double? InitialFee,
    double? PricePerMinute,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] PricingSnapshot? Pricing,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RideVehicleResponse? Vehicles)
{
    public static RideResponse FromEntity(Ride ride, RideVehicleResponse? vehicle = null) =>
        new(ride.Id, ride.UserId, ride.VehicleId, ride.StartStationId, ride.EndStationId, ride.Status,
            ride.StartedAt, ride.EndedAt, ride.StartedAt, ride.EndedAt,
            ride.StartLat, ride.StartLng, ride.EndLat, ride.EndLng,
            ride.DistanceMeters, ride.DurationSeconds, ride.DurationMinutes,
            ride.TotalCost, ride.TotalCost, ride.InitialFee, ride.PricePerMinute,
            ride.CreatedAt, ride.UpdatedAt,
            ride.InitialFee is null && ride.PricePerMinute is null
                ? null
                : new PricingSnapshot(ride.InitialFee ?? 0, ride.PricePerMinute ?? 0),
            vehicle);
}

public sealed record RideVehicleResponse(string? Model, VehicleType Type, string? QrCode);
