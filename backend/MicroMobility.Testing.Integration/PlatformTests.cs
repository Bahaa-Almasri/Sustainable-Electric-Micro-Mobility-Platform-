using System.Net;
using System.Text.Json;
using Hangfire;
using Hangfire.Storage;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using MicroMobility.DTOs;
using MicroMobility.Services.Auth;
using MicroMobility.Services.Reservations;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

public sealed class RealtimeTests : IntegrationTestBase
{
    public RealtimeTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Starting_a_ride_pushes_RideStarted_to_that_user_only()
    {
        var (rider, client) = await SignedInUserAsync();
        var (bystander, _) = await SignedInUserAsync();
        var vehicle = await SeedVehicleAsync();

        await using var riderConnection = await ConnectAsync(rider.Id, rider.Email);
        await using var bystanderConnection = await ConnectAsync(bystander.Id, bystander.Email);

        var received = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        riderConnection.On<JsonElement>(NotificationEvents.RideStarted, payload => received.TrySetResult(payload));
        var leaked = false;
        bystanderConnection.On<JsonElement>(NotificationEvents.RideStarted, _ => leaked = true);

        var start = await ReadAsync<StartRideResponse>(await PostAsync(client, "/rides/start", new StartRideRequest(vehicle.Id, 1, 1)));

        var payload = await received.Task.WaitAsync(TimeSpan.FromSeconds(10));
        payload.GetProperty("ride_id").GetString().Should().Be(start.RideId.ToString());
        payload.GetProperty("status").GetString().Should().Be("started");
        await Task.Delay(300);
        leaked.Should().BeFalse();
    }

    [Fact]
    public async Task Hub_rejects_connections_without_a_token()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Factory.Server.BaseAddress, "/hubs/notifications"), options =>
            {
                options.HttpMessageHandlerFactory = _ => Factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();

        var act = () => connection.StartAsync();
        await act.Should().ThrowAsync<HttpRequestException>().Where(e => e.StatusCode == HttpStatusCode.Unauthorized);
    }

    private async Task<HubConnection> ConnectAsync(Guid userId, string email)
    {
        var token = Factory.Services.GetRequiredService<ITokenService>().Issue(userId, email).Value;
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Factory.Server.BaseAddress, "/hubs/notifications"), options =>
            {
                // TestServer has no real sockets; long polling runs over its in-memory handler.
                options.HttpMessageHandlerFactory = _ => Factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .AddJsonProtocol(options => MicroMobility.Configuration.JsonSetup.Apply(options.PayloadSerializerOptions))
            .Build();
        await connection.StartAsync();
        return connection;
    }
}

/// <summary>Settings that need their own app instance (same container, separate host).</summary>
[Collection(IntegrationCollection.Name)]
public sealed class PlatformConfigurationTests : IAsyncLifetime
{
    private readonly IntegrationTestFixture _fixture;

    public PlatformConfigurationTests(IntegrationTestFixture fixture) => _fixture = fixture;

    public Task InitializeAsync() => _fixture.ResetDatabaseAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Auth_endpoints_are_rate_limited_per_ip()
    {
        await using var factory = new MicroMobilityWebApplicationFactory(_fixture.ConnectionString,
            new Dictionary<string, string?> { ["RateLimiting:AuthPermitLimit"] = "3" });
        var client = factory.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            var response = await client.PostAsync("/auth/login",
                new StringContent("{\"email\":\"x@example.com\",\"password\":\"y\"}", System.Text.Encoding.UTF8, "application/json"));
            statuses.Add(response.StatusCode);
        }

        statuses.Should().Equal(HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized,
            HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task With_hangfire_on_the_dashboard_is_mounted_and_the_sweep_is_scheduled()
    {
        await using var factory = new MicroMobilityWebApplicationFactory(_fixture.ConnectionString,
            new Dictionary<string, string?> { ["Hangfire:Enabled"] = "true", ["Hangfire:Server:WorkerCount"] = "1" });
        var client = factory.CreateClient();

        (await client.GetAsync("/hangfire")).StatusCode.Should().Be(HttpStatusCode.OK);   // open in Development

        using var storage = JobStorage.Current.GetConnection();
        storage.GetRecurringJobs().Should().Contain(j => j.Id == ReservationExpirySweepJob.RecurringJobId && j.Cron == "* * * * *");

        // Reads no longer expire inline: the scheduled job owns it.
        using var scope = factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IReservationFreshness>().Should().BeOfType<ScheduledReservationFreshness>();
    }

    [Fact]
    public async Task Swagger_document_is_served_in_development()
    {
        await using var factory = new MicroMobilityWebApplicationFactory(_fixture.ConnectionString);
        var response = await factory.CreateClient().GetAsync("/swagger/v1/swagger.json");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).Should().Contain("/rides/start");
    }
}
