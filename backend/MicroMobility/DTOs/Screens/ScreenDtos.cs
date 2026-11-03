namespace MicroMobility.DTOs;

// One response per screen. Optional sections are null when they failed to load (their message is
// under `errors`, keyed by the section's JSON name); [] means genuinely empty. `server_time` is the
// server's clock at response time, for clients that derive countdowns.

/// <summary>
/// With an active ride, `parking_stations` lists stations with a free slot and `stations` is empty;
/// otherwise `stations` lists active stations.
/// </summary>
public sealed record MapOverviewResponse(
    RideResponse? ActiveRide,
    IReadOnlyDictionary<string, PricingRate>? PricingRates,
    IReadOnlyList<StationResponse> Stations,
    IReadOnlyList<StationResponse> ParkingStations,
    IReadOnlyDictionary<string, string> Errors,
    DateTime ServerTime);

/// <summary>The profile is required (the request fails without it); the rest may fail on their own.</summary>
public sealed record AccountSummaryResponse(
    UserResponse Profile,
    IReadOnlyList<RideResponse>? Rides,
    IReadOnlyList<ReservationResponse>? Reservations,
    WalletOverviewResponse? Wallet,
    IReadOnlyDictionary<string, string> Errors,
    DateTime ServerTime);

/// <summary>The vehicle is required (404 if missing); `my_reservations` holds only the caller's, for this vehicle.</summary>
public sealed record VehicleDetailsResponse(
    VehicleWithStateResponse Vehicle,
    IReadOnlyList<ReservationResponse>? MyReservations,
    IReadOnlyDictionary<string, PricingRate>? PricingRates,
    IReadOnlyDictionary<string, string> Errors,
    DateTime ServerTime);
