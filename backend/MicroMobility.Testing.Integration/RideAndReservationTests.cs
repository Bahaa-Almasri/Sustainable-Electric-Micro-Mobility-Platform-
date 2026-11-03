using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Services.Reservations;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

public sealed class RideAndReservationTests : IntegrationTestBase
{
    public RideAndReservationTests(IntegrationTestFixture fixture) : base(fixture) { }

    private Task<VehicleAvailabilityStatus> AvailabilityOf(Guid vehicleId) =>
        WithDbAsync(db => db.Vehicles.Where(v => v.Id == vehicleId).Select(v => v.AvailabilityStatus).SingleAsync());

    [Fact]
    public async Task Full_ride_start_to_end_bills_from_the_rate_snapshot()
    {
        var (user, client) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync(type: VehicleType.Car);
        await SeedPricingAsync("car", 2.0, 0.5);

        var start = await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start",
            new StartRideRequest(vehicle.Id, 33.9, 35.5)));
        start.Pricing.Should().Be(new PricingSnapshot(2.0, 0.5));
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.InUse);

        var active = await ReadJsonAsync(await client.GetAsync("/rides/me/active"));
        active.GetProperty("ride_id").GetString().Should().Be(start.RideId.ToString());
        active.GetProperty("status").GetString().Should().Be("started");
        active.GetProperty("start_time").GetString().Should().EndWith("Z");
        active.GetProperty("vehicles").GetProperty("type").GetString().Should().Be("car");
        active.GetProperty("pricing").GetProperty("initial_fee").GetDouble().Should().Be(2.0);

        // Pretend the ride began 4.5 minutes ago: billed as 5 minutes.
        var startedAt = DateTime.UtcNow.AddSeconds(-270);
        await WithDbAsync(db => db.Rides.Where(r => r.Id == start.RideId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.StartedAt, startedAt)));

        var end = await ReadAsync<EndRideResponse>(await PostAsync(client, "/rides/end",
            new EndRideRequest(start.RideId, 33.91, 35.51)));
        end.DurationMinutes.Should().Be(5);
        end.TotalPrice.Should().Be(4.5);
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Available);

        var ride = await WithDbAsync(db => db.Rides.SingleAsync(r => r.Id == start.RideId));
        ride.Status.Should().Be(RideStatus.Completed);
        ride.TotalCost.Should().Be(4.5m);
        ride.UserId.Should().Be(user.Id);
        ride.EndedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));

        // No active ride now: JSON null, not 204.
        var none = await client.GetAsync("/rides/me/active");
        (await none.Content.ReadAsStringAsync()).Should().Be("null");

        var history = await ReadJsonAsync(await client.GetAsync("/rides/me"));
        history.GetArrayLength().Should().Be(1);
        history[0].GetProperty("cost").GetDouble().Should().Be(4.5);
        history[0].GetProperty("duration_minutes").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task Ending_twice_bills_once()
    {
        var (_, client) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();
        var start = await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)));

        await ReadAsync<EndRideResponse>(await PostAsync(client, "/rides/end", new EndRideRequest(start.RideId, 1, 1)));
        var problem = await ProblemAsync(await PostAsync(client, "/rides/end", new EndRideRequest(start.RideId, 1, 1)), 409);
        problem.GetProperty("code").GetString().Should().Be("RideNotActive");
    }

    [Fact]
    public async Task Cannot_end_someone_elses_ride()
    {
        var (_, rider) = await SignedInUserAsync();
        var (_, stranger) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();
        var start = await ReadAsync<StartRideResponse>(await PostAsync(rider, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)));

        await ProblemAsync(await PostAsync(stranger, "/rides/end", new EndRideRequest(start.RideId, 1, 1)), 403);
    }

    [Fact]
    public async Task One_active_ride_per_user()
    {
        var (_, client) = await SignedInUserAsync();
        var first = await SeedVehicleAsync();
        var second = await SeedVehicleAsync();
        await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start", new StartRideRequest(first.Id, 1, 1)));

        var problem = await ProblemAsync(await PostAsync(client, "/rides/start", new StartRideRequest(second.Id, 1, 1)), 409);
        problem.GetProperty("code").GetString().Should().Be("ActiveRideExists");
        (await AvailabilityOf(second.Id)).Should().Be(VehicleAvailabilityStatus.Available);
    }

    [Fact]
    public async Task Reserve_then_ride_converts_the_reservation()
    {
        var (_, client) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();

        var created = await ReadAsync<CreateReservationResponse>(await PostAsync(client, "/reservations/me",
            new ReservationCreateRequest(vehicle.Id, 10)));
        created.Reservation.Status.Should().Be(ReservationStatus.Active);
        created.Reservation.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(10), TimeSpan.FromMinutes(1));
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Reserved);

        await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)));

        var status = await WithDbAsync(db => db.Reservations.Where(r => r.Id == created.Reservation.ReservationId)
            .Select(r => r.Status).SingleAsync());
        status.Should().Be(ReservationStatus.ConvertedToRide);
    }

    [Fact]
    public async Task A_vehicle_reserved_by_someone_else_cannot_be_reserved_or_ridden()
    {
        var (_, owner) = await SignedInUserAsync();
        var (_, other) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();
        await ReadAsync<CreateReservationResponse>(await PostAsync(owner, "/reservations/me", new ReservationCreateRequest(vehicle.Id, null)));

        var reserve = await ProblemAsync(await PostAsync(other, "/reservations/me", new ReservationCreateRequest(vehicle.Id, null)), 409);
        reserve.GetProperty("detail").GetString().Should().Be("Vehicle is not available for reservation");

        var ride = await ProblemAsync(await PostAsync(other, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)), 409);
        ride.GetProperty("code").GetString().Should().Be("VehicleReservedByAnotherUser");
    }

    [Fact]
    public async Task Cancelling_releases_the_vehicle_and_only_the_owner_can_cancel()
    {
        var (_, owner) = await SignedInUserAsync();
        var (_, other) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();
        var created = await ReadAsync<CreateReservationResponse>(await PostAsync(owner, "/reservations/me",
            new ReservationCreateRequest(vehicle.Id, null)));
        var id = created.Reservation.ReservationId;

        await ProblemAsync(await other.DeleteAsync($"/reservations/me/{id}"), 404);
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Reserved);

        var cancelled = await ReadAsync<CancelReservationResponse>(await owner.DeleteAsync($"/reservations/me/{id}"));
        cancelled.Should().Be(new CancelReservationResponse(true, "Reservation cancelled successfully", id, ReservationStatus.Cancelled, 1));
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Available);

        var again = await ReadAsync<CancelReservationResponse>(await owner.DeleteAsync($"/reservations/me/{id}"));
        again.Message.Should().Be("Reservation already inactive");
        again.ReleasedVehicleCount.Should().Be(0);
    }

    [Fact]
    public async Task Lapsed_reservations_expire_on_read_and_free_the_vehicle()
    {
        var (_, client) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();
        var created = await ReadAsync<CreateReservationResponse>(await PostAsync(client, "/reservations/me",
            new ReservationCreateRequest(vehicle.Id, 5)));
        var reservedAt = DateTime.UtcNow.AddMinutes(-20);
        var expiresAt = DateTime.UtcNow.AddMinutes(-1);
        await WithDbAsync(db => db.Reservations.Where(r => r.Id == created.Reservation.ReservationId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.ReservedAt, reservedAt)
                .SetProperty(r => r.ExpiresAt, expiresAt)));

        var mine = await ReadAsync<List<ReservationResponse>>(await client.GetAsync("/reservations/me"));

        mine.Should().ContainSingle().Which.Status.Should().Be(ReservationStatus.Expired);
        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Available);
    }

    [Fact]
    public async Task Sweep_job_expires_lapsed_reservations_and_is_idempotent()
    {
        var (user, _) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync(availability: VehicleAvailabilityStatus.Reserved);
        await WithDbAsync(async db =>
        {
            db.Reservations.Add(new Reservation
            {
                UserId = user.Id, VehicleId = vehicle.Id, Status = ReservationStatus.Active,
                ReservedAt = DateTime.UtcNow.AddMinutes(-30), ExpiresAt = DateTime.UtcNow.AddMinutes(-15)
            });
            await db.SaveChangesAsync();
        });

        using (var scope = Factory.Services.CreateScope())
        {
            var job = scope.ServiceProvider.GetRequiredService<ReservationExpirySweepJob>();
            await job.RunAsync(CancellationToken.None);
            await job.RunAsync(CancellationToken.None);
        }

        (await AvailabilityOf(vehicle.Id)).Should().Be(VehicleAvailabilityStatus.Available);
        var statuses = await WithDbAsync(db => db.Reservations.Select(r => r.Status).ToListAsync());
        statuses.Should().Equal(ReservationStatus.Expired);
    }
}
