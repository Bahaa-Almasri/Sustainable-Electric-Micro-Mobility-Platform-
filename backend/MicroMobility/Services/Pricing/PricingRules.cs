using MicroMobility.Models;

namespace MicroMobility.Services.Pricing;

public sealed record VehicleRate(double InitialFee, double PricePerMinute, string Source);

public sealed record RideBill(int DurationMinutes, VehicleRate Rate, double TotalPrice);

/// <summary>
/// The pure pricing rules: type normalization, code defaults, billed minutes and totals.
/// No I/O, so every rule is unit-tested directly.
/// </summary>
public static class PricingRules
{
    public const string SourceDatabase = "database";
    public const string SourceDefault = "default";
    public const string SourceSafeFallback = "safe_fallback";

    /// <summary>The types listed in the pricing catalog, in display order.</summary>
    public static readonly IReadOnlyList<string> CatalogTypes = ["scooter", "bike", "car"];

    /// <summary>
    /// Fallback when a vehicle_pricing row is missing or unreadable. Must stay in sync with the
    /// seeded rows in vehicle_pricing.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, (double InitialFee, double PricePerMinute)> Defaults =
        new Dictionary<string, (double, double)>
        {
            ["scooter"] = (0.5, 0.2),
            ["bike"] = (0.75, 0.25),
            ["car"] = (1.5, 0.5),
        };

    private const string SafeFallbackType = "scooter";

    /// <summary>Lower-cases and folds "ebike" into "bike". Null for a blank type.</summary>
    public static string? NormalizeVehicleType(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var type = raw.Trim().ToLowerInvariant();
        return type == "ebike" ? "bike" : type;
    }

    public static string KeyFor(VehicleType type) => NormalizeVehicleType(type.ToString())!;

    /// <summary>Code default for a type; an unknown type gets the cheapest tier so a ride never fails to price.</summary>
    public static VehicleRate Fallback(string? normalizedType)
    {
        if (normalizedType is not null && Defaults.TryGetValue(normalizedType, out var rate))
        {
            return new VehicleRate(rate.InitialFee, rate.PricePerMinute, SourceDefault);
        }

        var safe = Defaults[SafeFallbackType];
        return new VehicleRate(safe.InitialFee, safe.PricePerMinute, SourceSafeFallback);
    }

    /// <summary>Billable minutes: elapsed wall time rounded up, at least 1. An end before the start bills 1.</summary>
    public static int BilledMinutes(DateTime startUtc, DateTime endUtc)
    {
        var elapsed = endUtc < startUtc ? TimeSpan.Zero : endUtc - startUtc;
        return Math.Max(1, (int)Math.Ceiling(elapsed.TotalSeconds / 60.0));
    }

    public static RideBill Bill(DateTime startUtc, DateTime endUtc, VehicleRate rate)
    {
        var minutes = BilledMinutes(startUtc, endUtc);
        var total = Math.Round(rate.InitialFee + minutes * rate.PricePerMinute, 4, MidpointRounding.ToEven);
        return new RideBill(minutes, rate, total);
    }
}
