namespace MicroMobility.Models;

public sealed class Ride
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? StartStationId { get; set; }
    public Guid? EndStationId { get; set; }
    public RideStatus Status { get; set; } = RideStatus.Reserved;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public double? StartLat { get; set; }
    public double? StartLng { get; set; }
    public double? EndLat { get; set; }
    public double? EndLng { get; set; }
    public double? DistanceMeters { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal TotalCost { get; set; }

    /// <summary>Rate snapshot taken at ride start; overwritten with the final rates at ride end.</summary>
    public double? InitialFee { get; set; }
    public double? PricePerMinute { get; set; }
    public int? DurationMinutes { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
}

public sealed class Reservation
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Active;
    public DateTime ReservedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
}

public sealed class RideCharge
{
    public Guid Id { get; set; }
    public Guid RideId { get; set; }
    public ChargeType ChargeType { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class RideEvent
{
    public Guid Id { get; set; }
    public Guid RideId { get; set; }
    public RideEventType EventType { get; set; }

    /// <summary>Raw jsonb document.</summary>
    public string? MetadataJson { get; set; }

    public DateTime EventTime { get; set; }
    public DateTime CreatedAt { get; set; }
}
