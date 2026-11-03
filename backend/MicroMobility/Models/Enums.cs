namespace MicroMobility.Models;

// Each enum mirrors a native PostgreSQL enum type of the same (snake_case) name. Npgsql maps
// members by name through its snake_case translator (InUse <-> 'in_use'), so the numeric values
// never reach the database. They start at 1 on purpose: 0 is then never a real member, which keeps
// EF Core from mistaking an explicitly chosen first member for "not set" and silently applying
// the column's database default instead.

public enum VehicleType { Scooter = 1, Bike, Ebike, Car }

public enum VehicleAvailabilityStatus { Available = 1, Reserved, InUse, Unavailable }

public enum VehicleOperationalStatus { Healthy = 1, LowBattery, Charging, Maintenance, Offline, Damaged }

public enum StationStatus { Active = 1, Inactive, Full, Maintenance }

public enum RideStatus { Reserved = 1, Started, Paused, Completed, Cancelled, Failed }

public enum ReservationStatus { Active = 1, Expired, Cancelled, ConvertedToRide }

public enum PaymentStatus { Pending = 1, Authorized, Paid, Failed, Refunded }

public enum TicketCategory { Payment = 1, VehicleIssue, RideIssue, Account, Other }

public enum TicketPriority { Low = 1, Medium, High, Urgent }

public enum TicketStatus { Open = 1, InProgress, Resolved, Closed }

public enum ChargeType { UnlockFee = 1, UsageFee, PauseFee, ParkingPenalty, DamagePenalty, Adjustment }

public enum RideEventType
{
    RideRequested = 1, RideStarted, RidePaused, RideResumed, RideEnded, RideCancelled,
    UnlockFailed, PaymentInitiated, PaymentFailed
}

public enum TelemetryEventType { Heartbeat = 1, LocationUpdate, BatteryUpdate, LockUpdate, RideEvent, Fault }

public enum UserVerificationType { Identity = 1, DriverLicense, StudentId }

public enum VerificationStatus { Pending = 1, Approved, Rejected, Expired }

public enum VehicleIssueType { Battery = 1, Brake, Tire, Motor, Gps, Lock, PhysicalDamage, Other }

public enum VehicleIssueStatus { Reported = 1, UnderReview, Resolved, Dismissed }
