using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;

namespace MicroMobility.Services.Pricing;

public interface IPricingService
{
    /// <summary>Live rate for a vehicle type: vehicle_pricing row, else code default, else the safe tier.</summary>
    Task<VehicleRate> GetRateAsync(string? vehicleType, CancellationToken cancellationToken);

    /// <summary>Resolved rates for every catalog type, keyed scooter | bike | car.</summary>
    Task<IReadOnlyDictionary<string, PricingRate>> GetCatalogAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Final bill for a trip. Re-resolves the rate at trip end, so an admin rate change applies to
    /// rides that end after it.
    /// </summary>
    Task<RideBill> CalculateAsync(DateTime startUtc, DateTime endUtc, string? vehicleType, CancellationToken cancellationToken);
}

public sealed class PricingService : IPricingService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PricingService> _logger;

    public PricingService(AppDbContext db, ILogger<PricingService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<VehicleRate> GetRateAsync(string? vehicleType, CancellationToken cancellationToken)
    {
        var type = PricingRules.NormalizeVehicleType(vehicleType);
        if (type is null) return PricingRules.Fallback(null);

        try
        {
            var row = await _db.VehiclePricing.AsNoTracking()
                .Where(x => x.VehicleType == type)
                .Select(x => new { x.InitialFee, x.PricePerMinute })
                .SingleOrDefaultAsync(cancellationToken);

            return row is null
                ? PricingRules.Fallback(type)
                : new VehicleRate(row.InitialFee, row.PricePerMinute, PricingRules.SourceDatabase);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Pricing must not take rides down with it: fall back to the code defaults.
            _logger.LogWarning(exception, "vehicle_pricing lookup failed for {VehicleType}; using defaults.", type);
            return PricingRules.Fallback(type);
        }
    }

    public async Task<IReadOnlyDictionary<string, PricingRate>> GetCatalogAsync(CancellationToken cancellationToken)
    {
        var types = PricingRules.CatalogTypes;
        var rows = await _db.VehiclePricing.AsNoTracking()
            .Where(x => types.Contains(x.VehicleType))
            .ToDictionaryAsync(x => x.VehicleType, cancellationToken);

        var catalog = new Dictionary<string, PricingRate>();
        foreach (var type in types)
        {
            var rate = rows.TryGetValue(type, out var row)
                ? new VehicleRate(row.InitialFee, row.PricePerMinute, PricingRules.SourceDatabase)
                : PricingRules.Fallback(type);
            catalog[type] = new PricingRate(rate.InitialFee, rate.PricePerMinute, rate.Source);
        }
        return catalog;
    }

    public async Task<RideBill> CalculateAsync(
        DateTime startUtc, DateTime endUtc, string? vehicleType, CancellationToken cancellationToken)
    {
        var rate = await GetRateAsync(vehicleType, cancellationToken);
        return PricingRules.Bill(startUtc, endUtc, rate);
    }
}
