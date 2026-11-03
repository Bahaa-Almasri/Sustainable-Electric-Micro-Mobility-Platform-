using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Helpers;
using MicroMobility.Models;
using MicroMobility.Services.CurrentUser;

namespace MicroMobility.Services.WalletService;

public interface IWalletService
{
    /// <summary>Packages on sale, cheapest first.</summary>
    Task<IReadOnlyList<RidePackageResponse>> ListPackagesAsync(CancellationToken cancellationToken);

    Task<WalletOverviewResponse> GetOverviewAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Grants a package's ride credits. There is no payment gateway yet: no money moves and no
    /// payments row is written (payments.ride_id is NOT NULL, so a package payment cannot be
    /// represented until that schema changes).
    /// </summary>
    Task<PurchasePackageResponse> PurchaseAsync(PurchasePackageRequest request, CancellationToken cancellationToken);
}

public sealed class WalletService : IWalletService
{
    private const int RecentPaymentsLimit = 20;

    private readonly AppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public WalletService(AppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<RidePackageResponse>> ListPackagesAsync(CancellationToken cancellationToken)
    {
        var packages = await _db.RidePackages.AsNoTracking()
            .Where(p => p.IsActive ?? true)
            .OrderBy(p => p.Price == null)
            .ThenBy(p => p.Price)
            .ToListAsync(cancellationToken);
        return packages.Select(RidePackageResponse.FromEntity).ToList();
    }

    public async Task<WalletOverviewResponse> GetOverviewAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();

        var purchases = await _db.UserPackagePurchases.AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderBy(p => p.CreatedAt == null)
            .ThenByDescending(p => p.CreatedAt)
            .Select(p => new PurchaseResponse(
                p.Id, p.UserId, p.PackageId, p.RidesRemaining, p.PaymentId, p.CreatedAt,
                p.Package.Title, p.Package.RideCredits, p.Package.Price, p.Package.Currency,
                new PurchasePackageInfo(p.Package.Title, p.Package.RideCredits, p.Package.Price, p.Package.Currency)))
            .ToListAsync(cancellationToken);

        var methods = await _db.PaymentMethods.AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.IsDefault ?? false)
            .Select(m => new PaymentMethodResponse(m.Id, m.UserId, m.Provider, m.LastFour, m.Brand, m.IsDefault, m.CreatedAt))
            .ToListAsync(cancellationToken);

        var payments = await _db.Payments.AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Take(RecentPaymentsLimit)
            .Select(p => new PaymentResponse(
                p.Id, p.UserId, p.RideId, p.Amount, p.Currency.Trim(), p.Status, p.Provider, p.Provider,
                p.ProviderPaymentReference, p.FailureReason, p.PaidAt, p.CreatedAt, p.UpdatedAt))
            .ToListAsync(cancellationToken);

        return new WalletOverviewResponse(purchases, methods, payments);
    }

    public async Task<PurchasePackageResponse> PurchaseAsync(
        PurchasePackageRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var packageId = Guard.Required(request.PackageId, "package_id");

        var package = await _db.RidePackages.AsNoTracking()
            .Where(p => p.Id == packageId)
            .Select(p => new { p.RideCredits })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Package not found");

        var purchase = new UserPackagePurchase
        {
            UserId = userId,
            PackageId = packageId,
            RidesRemaining = package.RideCredits ?? 0
        };
        _db.UserPackagePurchases.Add(purchase);
        await _db.SaveChangesAsync(cancellationToken);

        return new PurchasePackageResponse(true, purchase.Id, null);
    }
}
