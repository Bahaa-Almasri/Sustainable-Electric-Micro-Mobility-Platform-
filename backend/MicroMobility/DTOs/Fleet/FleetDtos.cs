using System.Text.Json.Serialization;
using MicroMobility.Models;

namespace MicroMobility.DTOs;

/// <summary>
/// A vehicle with its live state, in the shape the app's map and vehicle screens read.
/// `model` and `qr_code` are not stored yet and are always null; they stay in the contract.
/// </summary>
public sealed record VehicleWithStateResponse(
    Guid? StateId,
    Guid VehicleId,
    int? BatteryLevel,
    double? Lat,
    double? Lng,
    VehicleOperationalStatus Status,
    DateTime? LastUpdated,
    VehicleSummaryResponse Vehicles);

public sealed record VehicleSummaryResponse(
    Guid VehicleId,
    string? Model,
    VehicleType Type,
    string? QrCode,
    VehicleAvailabilityStatus Status,
    DateTime? LastGpsAt);

public sealed record StationResponse(
    Guid StationId,
    string Name,
    double Lat,
    double Lng,
    int Capacity,
    int AvailableVehicles,
    // Only the parking-available list carries this.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? AvailableParkingSpots);

/// <summary>Per-minute rates applied to a ride.</summary>
public sealed record PricingSnapshot(double InitialFee, double PricePerMinute);

/// <summary>A catalog rate plus where it came from: "database", "default" or "safe_fallback".</summary>
public sealed record PricingRate(double InitialFee, double PricePerMinute, string Source);

public sealed record PricingCatalogResponse(IReadOnlyDictionary<string, PricingRate> Rates);
