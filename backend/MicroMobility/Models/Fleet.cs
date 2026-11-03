namespace MicroMobility.Models;

public sealed class Station
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Lat { get; set; }
    public double Lng { get; set; }
    public int Capacity { get; set; }
    public StationStatus Status { get; set; } = StationStatus.Active;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<Vehicle> Vehicles { get; set; } = new();
}

public sealed class Vehicle
{
    public Guid Id { get; set; }
    public VehicleType Type { get; set; }
    public VehicleAvailabilityStatus AvailabilityStatus { get; set; } = VehicleAvailabilityStatus.Available;
    public VehicleOperationalStatus OperationalStatus { get; set; } = VehicleOperationalStatus.Healthy;
    public Guid? StationId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Station? Station { get; set; }
    public VehicleCurrentState? CurrentState { get; set; }
}

/// <summary>Latest known position/battery of a vehicle (one row per vehicle, keyed by vehicle id).</summary>
public sealed class VehicleCurrentState
{
    public Guid VehicleId { get; set; }
    public double? CurrentLat { get; set; }
    public double? CurrentLng { get; set; }
    public int? CurrentBatteryPercent { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool IsLocked { get; set; } = true;
    public DateTime UpdatedAt { get; set; }

    public Vehicle Vehicle { get; set; } = null!;
}

/// <summary>Live per-type rates. The primary source of truth for ride pricing.</summary>
public sealed class VehiclePricing
{
    public long Id { get; set; }

    /// <summary>Normalized type key: scooter | bike | car (plain text, not the enum).</summary>
    public string VehicleType { get; set; } = string.Empty;

    public double InitialFee { get; set; }
    public double PricePerMinute { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class TelemetryEvent
{
    public Guid Id { get; set; }
    public Guid VehicleId { get; set; }
    public DateTime Ts { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public int? BatteryPercent { get; set; }
    public double? Speed { get; set; }
    public TelemetryEventType EventType { get; set; } = TelemetryEventType.Heartbeat;
    public DateTime CreatedAt { get; set; }
}

public sealed class VehicleIssue
{
    public Guid Id { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? RideId { get; set; }
    public VehicleIssueType IssueType { get; set; }
    public string? Description { get; set; }
    public VehicleIssueStatus Status { get; set; } = VehicleIssueStatus.Reported;
    public DateTime ReportedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
