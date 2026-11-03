using MicroMobility.Models;

namespace MicroMobility.DTOs;

/// <summary>
/// Realtime event names on /hubs/notifications. Each is sent only to the user it concerns;
/// clients refresh the matching screen when one arrives.
/// </summary>
public static class NotificationEvents
{
    public const string RideStarted = "RideStarted";
    public const string RideEnded = "RideEnded";
    public const string ReservationCreated = "ReservationCreated";
    public const string ReservationCancelled = "ReservationCancelled";
    public const string ReservationExpired = "ReservationExpired";
}

public sealed record RideNotificationPayload(Guid RideId, Guid VehicleId, RideStatus Status, decimal? TotalCost);

public sealed record ReservationNotificationPayload(Guid ReservationId, Guid VehicleId, ReservationStatus Status, DateTime? ExpiresAt);
