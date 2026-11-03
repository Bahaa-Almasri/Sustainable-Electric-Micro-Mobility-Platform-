using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

public sealed class FleetTests : IntegrationTestBase
{
    public FleetTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Active_stations_count_only_rentable_vehicles()
    {
        var (_, client) = await SignedInUserAsync();
        var central = await SeedStationAsync("Central", capacity: 5);
        await SeedStationAsync("Closed", status: StationStatus.Maintenance);
        await SeedVehicleAsync(central.Id);
        await SeedVehicleAsync(central.Id);
        await SeedVehicleAsync(central.Id, availability: VehicleAvailabilityStatus.Reserved);

        var stations = await ReadAsync<List<StationResponse>>(await client.GetAsync("/stations/active"));

        stations.Should().ContainSingle();
        stations[0].Name.Should().Be("Central");
        stations[0].AvailableVehicles.Should().Be(2);
        stations[0].AvailableParkingSpots.Should().BeNull();
    }

    [Fact]
    public async Task Parking_available_is_capacity_minus_docked_vehicles_not_on_a_ride()
    {
        var (_, client) = await SignedInUserAsync();
        var small = await SeedStationAsync("Small", capacity: 2);
        var full = await SeedStationAsync("Full", capacity: 1);
        await SeedVehicleAsync(small.Id);
        await SeedVehicleAsync(full.Id);

        var stations = await ReadAsync<List<StationResponse>>(await client.GetAsync("/stations/parking-available"));

        stations.Should().ContainSingle(s => s.Name == "Small").Which.AvailableParkingSpots.Should().Be(1);
        stations.Should().NotContain(s => s.Name == "Full");
    }

    [Fact]
    public async Task Available_vehicles_have_the_nested_shape_the_map_reads()
    {
        var (_, client) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync(type: VehicleType.Ebike);
        await SeedVehicleAsync(availability: VehicleAvailabilityStatus.InUse);

        var response = await client.GetAsync("/vehicles/available");
        var json = await ReadJsonAsync(response);

        json.GetArrayLength().Should().Be(1);
        var item = json[0];
        item.GetProperty("vehicle_id").GetString().Should().Be(vehicle.Id.ToString());
        item.GetProperty("state_id").GetString().Should().Be(vehicle.Id.ToString());
        item.GetProperty("battery_level").GetInt32().Should().Be(87);
        item.GetProperty("status").GetString().Should().Be("healthy");
        item.GetProperty("last_updated").GetString().Should().EndWith("Z");
        var nested = item.GetProperty("vehicles");
        nested.GetProperty("type").GetString().Should().Be("ebike");
        nested.GetProperty("status").GetString().Should().Be("available");
        nested.GetProperty("model").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
        nested.GetProperty("qr_code").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public async Task Station_vehicles_404_for_an_inactive_station()
    {
        var (_, client) = await SignedInUserAsync();
        var closed = await SeedStationAsync(status: StationStatus.Inactive);

        var problem = await ProblemAsync(await client.GetAsync($"/stations/{closed.Id}/vehicles"), 404);
        problem.GetProperty("detail").GetString().Should().Be("Station not found or inactive");
    }

    [Fact]
    public async Task Station_vehicles_lists_only_rentable_vehicles_at_that_station()
    {
        var (_, client) = await SignedInUserAsync();
        var station = await SeedStationAsync();
        var here = await SeedVehicleAsync(station.Id);
        await SeedVehicleAsync(station.Id, availability: VehicleAvailabilityStatus.Unavailable);
        await SeedVehicleAsync();

        var vehicles = await ReadAsync<List<VehicleWithStateResponse>>(await client.GetAsync($"/stations/{station.Id}/vehicles"));

        vehicles.Should().ContainSingle().Which.VehicleId.Should().Be(here.Id);
    }

    [Fact]
    public async Task Unknown_vehicle_is_a_404()
    {
        var (_, client) = await SignedInUserAsync();
        await ProblemAsync(await client.GetAsync($"/vehicles/{Guid.NewGuid()}"), 404);
    }

    [Fact]
    public async Task Pricing_catalog_prefers_the_database_and_falls_back_to_defaults()
    {
        var (_, client) = await SignedInUserAsync();
        await SeedPricingAsync("scooter", 1.0, 0.3);

        var catalog = await ReadAsync<PricingCatalogResponse>(await client.GetAsync("/rides/pricing/catalog"));

        catalog.Rates["scooter"].Should().Be(new PricingRate(1.0, 0.3, "database"));
        catalog.Rates["bike"].Should().Be(new PricingRate(0.75, 0.25, "default"));
        catalog.Rates["car"].Should().Be(new PricingRate(1.5, 0.5, "default"));
    }
}
