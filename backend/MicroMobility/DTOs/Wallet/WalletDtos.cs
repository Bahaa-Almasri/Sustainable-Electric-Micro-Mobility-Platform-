using MicroMobility.Models;

namespace MicroMobility.DTOs;

public sealed record PurchasePackageRequest(Guid? PackageId);

public sealed record PurchasePackageResponse(bool Ok, Guid PurchaseId, Guid? PaymentId);

public sealed record RidePackageResponse(
    Guid PackageId,
    string? Title,
    string? Description,
    int? RideCredits,
    decimal? Price,
    string? Currency,
    bool? IsActive)
{
    public static RidePackageResponse FromEntity(RidePackage p) =>
        new(p.Id, p.Title, p.Description, p.RideCredits, p.Price, p.Currency, p.IsActive);
}

/// <summary>A purchase with its package, both flattened (legacy shape) and nested as `ride_packages`.</summary>
public sealed record PurchaseResponse(
    Guid PurchaseId,
    Guid UserId,
    Guid PackageId,
    int? RidesRemaining,
    Guid? PaymentId,
    DateTime? CreatedAt,
    string? Title,
    int? RideCredits,
    decimal? Price,
    string? Currency,
    PurchasePackageInfo RidePackages);

public sealed record PurchasePackageInfo(string? Title, int? RideCredits, decimal? Price, string? Currency);

public sealed record PaymentMethodResponse(
    Guid MethodId,
    Guid UserId,
    string? Provider,
    string? LastFour,
    string? Brand,
    bool? IsDefault,
    DateTime? CreatedAt);

/// <summary>Payment row. `method` mirrors `provider` — the app's name for it.</summary>
public sealed record PaymentResponse(
    Guid PaymentId,
    Guid UserId,
    Guid RideId,
    decimal Amount,
    string Currency,
    PaymentStatus Status,
    string? Provider,
    string? Method,
    string? ProviderPaymentReference,
    string? FailureReason,
    DateTime? PaidAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record WalletOverviewResponse(
    IReadOnlyList<PurchaseResponse> Purchases,
    IReadOnlyList<PaymentMethodResponse> PaymentMethods,
    IReadOnlyList<PaymentResponse> RecentPayments);
