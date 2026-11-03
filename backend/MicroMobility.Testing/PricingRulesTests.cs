using MicroMobility.Models;
using MicroMobility.Services.Pricing;
using MicroMobility.Services.Reservations;

namespace MicroMobility.Testing;

public sealed class PricingRulesTests
{
    private static readonly DateTime Start = new(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(0, 1)]          // an instant ride still bills one minute
    [InlineData(1, 1)]
    [InlineData(60, 1)]
    [InlineData(61, 2)]         // any part of a minute is a minute
    [InlineData(600, 10)]
    [InlineData(-30, 1)]        // end before start bills the minimum, never negative
    public void BilledMinutes_rounds_elapsed_time_up_with_a_one_minute_floor(int elapsedSeconds, int expected)
    {
        PricingRules.BilledMinutes(Start, Start.AddSeconds(elapsedSeconds)).Should().Be(expected);
    }

    [Fact]
    public void Bill_is_initial_fee_plus_minutes_times_rate()
    {
        var bill = PricingRules.Bill(Start, Start.AddMinutes(9).AddSeconds(1), new VehicleRate(0.5, 0.2, "database"));

        bill.DurationMinutes.Should().Be(10);
        bill.TotalPrice.Should().Be(2.5);
    }

    [Theory]
    [InlineData("scooter", "scooter")]
    [InlineData(" Bike ", "bike")]
    [InlineData("EBIKE", "bike")]   // e-bikes are priced as bikes
    [InlineData("car", "car")]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void NormalizeVehicleType_lowercases_and_folds_ebike_into_bike(string? raw, string? expected)
    {
        PricingRules.NormalizeVehicleType(raw).Should().Be(expected);
    }

    [Fact]
    public void KeyFor_maps_every_vehicle_enum_to_a_catalog_key()
    {
        foreach (var type in Enum.GetValues<VehicleType>())
        {
            PricingRules.CatalogTypes.Should().Contain(PricingRules.KeyFor(type));
        }
    }

    [Fact]
    public void Fallback_uses_the_type_default_or_the_safe_tier_for_unknown_types()
    {
        PricingRules.Fallback("car").Should().Be(new VehicleRate(1.5, 0.5, PricingRules.SourceDefault));
        PricingRules.Fallback("hoverboard").Should().Be(new VehicleRate(0.5, 0.2, PricingRules.SourceSafeFallback));
        PricingRules.Fallback(null).Source.Should().Be(PricingRules.SourceSafeFallback);
    }

    [Theory]
    [InlineData(null, 15)]
    [InlineData(0, 1)]
    [InlineData(30, 30)]
    [InlineData(500, 60)]
    public void Reservation_ttl_is_clamped_not_rejected(int? requested, int expected)
    {
        new ReservationOptions().NormalizeTtl(requested).Should().Be(expected);
    }
}
