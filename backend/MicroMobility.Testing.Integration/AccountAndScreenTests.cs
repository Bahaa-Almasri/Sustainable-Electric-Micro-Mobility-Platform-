using System.Text.Json;
using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

public sealed class AccountAndScreenTests : IntegrationTestBase
{
    public AccountAndScreenTests(IntegrationTestFixture fixture) : base(fixture) { }

    private Task<RidePackage> SeedPackageAsync(string title, decimal price, int credits, bool active = true) =>
        WithDbAsync(async db =>
        {
            var package = new RidePackage { Title = title, Price = price, RideCredits = credits, IsActive = active, Currency = "USD" };
            db.RidePackages.Add(package);
            await db.SaveChangesAsync();
            return package;
        });

    [Fact]
    public async Task Packages_are_active_only_and_cheapest_first()
    {
        var (_, client) = await SignedInUserAsync();
        await SeedPackageAsync("Commuter 20", 39.99m, 20);
        await SeedPackageAsync("City 5-pack", 12.99m, 5);
        await SeedPackageAsync("Retired", 1m, 1, active: false);

        var packages = await ReadAsync<List<RidePackageResponse>>(await client.GetAsync("/wallet/packages"));

        packages.Select(p => p.Title).Should().Equal("City 5-pack", "Commuter 20");
    }

    [Fact]
    public async Task Purchasing_a_package_grants_its_credits_and_shows_in_the_overview()
    {
        var (user, client) = await SignedInUserAsync();
        var package = await SeedPackageAsync("City 5-pack", 12.99m, 5);

        var purchase = await ReadAsync<PurchasePackageResponse>(await PostAsync(client, "/wallet/purchase",
            new PurchasePackageRequest(package.Id)));
        purchase.Ok.Should().BeTrue();

        var overview = await ReadJsonAsync(await client.GetAsync("/wallet/overview"));
        var bought = overview.GetProperty("purchases")[0];
        bought.GetProperty("purchase_id").GetString().Should().Be(purchase.PurchaseId.ToString());
        bought.GetProperty("user_id").GetString().Should().Be(user.Id.ToString());
        bought.GetProperty("rides_remaining").GetInt32().Should().Be(5);
        bought.GetProperty("ride_packages").GetProperty("title").GetString().Should().Be("City 5-pack");
        overview.GetProperty("payment_methods").GetArrayLength().Should().Be(0);
        overview.GetProperty("recent_payments").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Buying_an_unknown_package_is_a_404()
    {
        var (_, client) = await SignedInUserAsync();
        await ProblemAsync(await PostAsync(client, "/wallet/purchase", new PurchasePackageRequest(Guid.NewGuid())), 404);
    }

    [Fact]
    public async Task Support_ticket_round_trip_keeps_the_subject()
    {
        var (_, client) = await SignedInUserAsync();

        var created = await ReadJsonAsync(await PostAsync(client, "/support/tickets",
            new { subject = "Brake feels soft", description = "Scooter near the station." }));
        created.GetProperty("ok").GetBoolean().Should().BeTrue();

        var tickets = await ReadJsonAsync(await client.GetAsync("/support/tickets"));
        var ticket = tickets[0];
        ticket.GetProperty("subject").GetString().Should().Be("Brake feels soft");
        ticket.GetProperty("title").GetString().Should().Be("Brake feels soft");
        ticket.GetProperty("status").GetString().Should().Be("open");
        ticket.GetProperty("category").GetString().Should().Be("other");
        ticket.GetProperty("priority").GetString().Should().Be("medium");
    }

    [Fact]
    public async Task Support_ticket_without_a_subject_is_a_400()
    {
        var (_, client) = await SignedInUserAsync();
        var problem = await ProblemAsync(await PostAsync(client, "/support/tickets", new { subject = " ", description = "x" }), 400);
        problem.GetProperty("detail").GetString().Should().Be("subject is required.");
    }

    [Fact]
    public async Task Map_overview_lists_stations_without_a_ride_and_parking_with_one()
    {
        var (_, client) = await SignedInUserAsync();
        var station = await SeedStationAsync(capacity: 3);
        var vehicle = await SeedVehicleAsync(station.Id);

        var idle = await ReadAsync<MapOverviewResponse>(await client.GetAsync("/map/overview"));
        idle.ActiveRide.Should().BeNull();
        idle.Stations.Should().ContainSingle().Which.AvailableVehicles.Should().Be(1);
        idle.ParkingStations.Should().BeEmpty();
        idle.PricingRates.Should().ContainKeys("scooter", "bike", "car");
        idle.Errors.Should().BeEmpty();

        await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)));

        var riding = await ReadAsync<MapOverviewResponse>(await client.GetAsync("/map/overview"));
        riding.ActiveRide.Should().NotBeNull();
        riding.Stations.Should().BeEmpty();
        // The vehicle being ridden no longer occupies its slot.
        riding.ParkingStations.Should().ContainSingle().Which.AvailableParkingSpots.Should().Be(3);
    }

    [Fact]
    public async Task Account_summary_carries_every_section()
    {
        var (user, client) = await SignedInUserAsync();

        var json = await ReadJsonAsync(await client.GetAsync("/users/me/summary"));

        json.GetProperty("profile").GetProperty("user_id").GetString().Should().Be(user.Id.ToString());
        json.GetProperty("rides").GetArrayLength().Should().Be(0);
        json.GetProperty("reservations").GetArrayLength().Should().Be(0);
        json.GetProperty("wallet").GetProperty("purchases").GetArrayLength().Should().Be(0);
        json.GetProperty("errors").EnumerateObject().Should().BeEmpty();
        json.GetProperty("server_time").GetString().Should().EndWith("Z");
    }

    [Fact]
    public async Task Vehicle_details_holds_only_my_reservations_for_that_vehicle()
    {
        var (_, client) = await SignedInUserAsync();
        var target = await SeedVehicleAsync();
        var otherVehicle = await SeedVehicleAsync();
        await ReadAsync<CreateReservationResponse>(await PostAsync(client, "/reservations/me", new ReservationCreateRequest(target.Id, null)));

        var details = await ReadAsync<VehicleDetailsResponse>(await client.GetAsync($"/vehicles/{target.Id}/details"));
        details.Vehicle.VehicleId.Should().Be(target.Id);
        details.MyReservations.Should().ContainSingle().Which.VehicleId.Should().Be(target.Id);

        var other = await ReadAsync<VehicleDetailsResponse>(await client.GetAsync($"/vehicles/{otherVehicle.Id}/details"));
        other.MyReservations.Should().BeEmpty();

        await ProblemAsync(await client.GetAsync($"/vehicles/{Guid.NewGuid()}/details"), 404);
    }
}
