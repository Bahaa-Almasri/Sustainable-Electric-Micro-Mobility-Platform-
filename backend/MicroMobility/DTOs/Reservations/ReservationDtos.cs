using MicroMobility.Models;

namespace MicroMobility.DTOs;

/// <summary>`minutes_ttl` defaults to 15 and is clamped to 1–60.</summary>
public sealed record ReservationCreateRequest(Guid? VehicleId, int? MinutesTtl);

public sealed record ReservationResponse(
    Guid ReservationId,
    Guid UserId,
    Guid VehicleId,
    ReservationStatus Status,
    DateTime ReservedAt,
    DateTime ExpiresAt,
    DateTime? CancelledAt,
    DateTime CreatedAt,
    ReservationVehicleResponse Vehicles);

public sealed record ReservationVehicleResponse(
    Guid VehicleId,
    string? Model,
    VehicleType Type,
    string? QrCode,
    VehicleAvailabilityStatus Status);

public sealed record CreateReservationResponse(bool Ok, CreatedReservation Reservation);

public sealed record CreatedReservation(
    Guid ReservationId,
    Guid UserId,
    Guid VehicleId,
    ReservationStatus Status,
    DateTime CreatedAt,
    DateTime ExpiresAt);

public sealed record CancelReservationResponse(
    bool Ok,
    string Message,
    Guid ReservationId,
    ReservationStatus Status,
    int ReleasedVehicleCount);
