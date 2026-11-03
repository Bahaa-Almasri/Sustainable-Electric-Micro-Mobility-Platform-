namespace MicroMobility.Models;

public sealed class RidePackage
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? RideCredits { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; } = "USD";
    public bool? IsActive { get; set; } = true;
}

public sealed class UserPackagePurchase
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid PackageId { get; set; }
    public int? RidesRemaining { get; set; }
    public Guid? PaymentId { get; set; }
    public DateTime? CreatedAt { get; set; }

    public RidePackage Package { get; set; } = null!;
}

public sealed class PaymentMethod
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? Provider { get; set; }
    public string? LastFour { get; set; }
    public string? Brand { get; set; }
    public bool? IsDefault { get; set; } = false;
    public DateTime? CreatedAt { get; set; }
}

/// <summary>A charge for a ride. Every payment belongs to a ride (ride_id is NOT NULL).</summary>
public sealed class Payment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid RideId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? Provider { get; set; }
    public string? ProviderPaymentReference { get; set; }
    public string? FailureReason { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class SupportTicket
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? RideId { get; set; }
    public TicketCategory Category { get; set; } = TicketCategory.Other;
    public TicketPriority Priority { get; set; } = TicketPriority.Medium;
    public TicketStatus Status { get; set; } = TicketStatus.Open;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public sealed class UserVerification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public UserVerificationType VerificationType { get; set; }
    public VerificationStatus Status { get; set; } = VerificationStatus.Pending;
    public string? ProviderReference { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
