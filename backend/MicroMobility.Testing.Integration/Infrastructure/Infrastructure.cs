using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MicroMobility.Configuration;
using MicroMobility.Data;
using MicroMobility.Models;
using MicroMobility.Services.Auth;
using Npgsql;
using Respawn;
using Respawn.Graph;
using Testcontainers.PostgreSql;

namespace MicroMobility.Testing.Integration.Infrastructure;

/// <summary>
/// Boots the real app against the test PostgreSQL container. Startup migrations build the schema
/// from InitialSchema, so these tests also prove the migration produces a working database.
/// </summary>
public sealed class MicroMobilityWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string JwtSecret = "integration-test-secret-32-bytes-long!!";

    private readonly string _connectionString;
    private readonly IReadOnlyDictionary<string, string?> _overrides;

    public MicroMobilityWebApplicationFactory(string connectionString, IReadOnlyDictionary<string, string?>? overrides = null)
    {
        _connectionString = connectionString;
        _overrides = overrides ?? new Dictionary<string, string?>();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development: CORS allows localhost, HTTPS redirection is off. The developer's own
        // appsettings.Development.json (with the Neon connection string) is loaded too, so every
        // setting that could reach a real service is overridden here.
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _connectionString);
        builder.UseSetting("Jwt:Secret", JwtSecret);
        builder.UseSetting("Hangfire:Enabled", "false");
        builder.UseSetting("RateLimiting:GlobalPermitLimit", "100000");
        builder.UseSetting("RateLimiting:AuthPermitLimit", "100000");
        foreach (var (key, value) in _overrides) builder.UseSetting(key, value);
    }
}

/// <summary>One PostgreSQL container and one app for the whole run; Respawn empties tables between tests.</summary>
public sealed class IntegrationTestFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder().WithImage("postgres:17-alpine").Build();
    private NpgsqlConnection _respawnConnection = null!;
    private Respawner _respawner = null!;

    public MicroMobilityWebApplicationFactory Factory { get; private set; } = null!;
    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Belt and braces: an environment variable outranks the developer's appsettings.Development.json
        // (which points at Neon), so the app can never boot against the real database in a test run.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", ConnectionString);

        Factory = new MicroMobilityWebApplicationFactory(ConnectionString);
        _ = Factory.Server;   // boots the app: runs the migrations
        AssertAppUsesTestContainer(Factory);

        _respawnConnection = new NpgsqlConnection(ConnectionString);
        await _respawnConnection.OpenAsync();
        _respawner = await Respawner.CreateAsync(_respawnConnection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = [new Table("__EFMigrationsHistory")]
        });
    }

    public Task ResetDatabaseAsync() => _respawner.ResetAsync(_respawnConnection);

    public static void AssertAppUsesTestContainer(MicroMobilityWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var appConnection = new NpgsqlConnectionStringBuilder(
            scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.GetDbConnection().ConnectionString);
        if (appConnection.Host is not ("localhost" or "127.0.0.1"))
        {
            throw new InvalidOperationException(
                $"Integration tests must run against the local test container, but the app is connected to '{appConnection.Host}'.");
        }
    }

    public async Task DisposeAsync()
    {
        await _respawnConnection.DisposeAsync();
        await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class IntegrationCollection : ICollectionFixture<IntegrationTestFixture>
{
    public const string Name = "Integration";
}

/// <summary>
/// Base for tests sharing the app and container. The database is reset before each test (not
/// after), so a failed test's state stays inspectable. One collection = sequential execution.
/// </summary>
[Collection(IntegrationCollection.Name)]
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected static readonly JsonSerializerOptions Json = CreateJson();

    protected IntegrationTestBase(IntegrationTestFixture fixture)
    {
        Fixture = fixture;
        Client = fixture.Factory.CreateClient();
    }

    protected IntegrationTestFixture Fixture { get; }
    protected MicroMobilityWebApplicationFactory Factory => Fixture.Factory;
    protected HttpClient Client { get; }

    public virtual Task InitializeAsync() => Fixture.ResetDatabaseAsync();
    public virtual Task DisposeAsync() => Task.CompletedTask;

    private static JsonSerializerOptions CreateJson()
    {
        var options = new JsonSerializerOptions();
        JsonSetup.Apply(options);
        return options;
    }

    protected async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    protected Task WithDbAsync(Func<AppDbContext, Task> action) =>
        WithDbAsync(async db => { await action(db); return true; });

    /// <summary>Seeds a user and returns a client signed in as them (a real token from the app's issuer).</summary>
    protected async Task<(User User, HttpClient Client)> SignedInUserAsync(string? email = null)
    {
        var user = new User
        {
            Email = email ?? $"rider-{Guid.NewGuid():N}@example.com",
            Name = "Test Rider",
            PhoneNumber = "+15555550100",
            Status = "active"
        };
        await WithDbAsync(async db => { db.Users.Add(user); await db.SaveChangesAsync(); });

        var token = Factory.Services.GetRequiredService<ITokenService>().Issue(user.Id, user.Email);
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Value);
        return (user, client);
    }

    protected Task<Station> SeedStationAsync(string name = "Central", int capacity = 5, StationStatus status = StationStatus.Active) =>
        WithDbAsync(async db =>
        {
            var station = new Station { Name = name, Lat = 33.89, Lng = 35.50, Capacity = capacity, Status = status };
            db.Stations.Add(station);
            await db.SaveChangesAsync();
            return station;
        });

    protected Task<Vehicle> SeedVehicleAsync(
        Guid? stationId = null,
        VehicleType type = VehicleType.Scooter,
        VehicleAvailabilityStatus availability = VehicleAvailabilityStatus.Available) =>
        WithDbAsync(async db =>
        {
            var vehicle = new Vehicle { Type = type, AvailabilityStatus = availability, StationId = stationId };
            vehicle.CurrentState = new VehicleCurrentState { CurrentLat = 33.89, CurrentLng = 35.50, CurrentBatteryPercent = 87 };
            db.Vehicles.Add(vehicle);
            await db.SaveChangesAsync();
            return vehicle;
        });

    protected Task SeedPricingAsync(string type, double initialFee, double perMinute) =>
        WithDbAsync(async db =>
        {
            db.VehiclePricing.Add(new VehiclePricing { VehicleType = type, InitialFee = initialFee, PricePerMinute = perMinute });
            await db.SaveChangesAsync();
        });

    protected static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        response.IsSuccessStatusCode.Should().BeTrue($"expected success but got {(int)response.StatusCode}: {body}");
        return JsonSerializer.Deserialize<T>(body, Json)!;
    }

    protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    protected static Task<HttpResponseMessage> PostAsync(HttpClient client, string url, object body) =>
        client.PostAsJsonAsync(url, body, Json);

    /// <summary>Asserts a ProblemDetails error and returns it.</summary>
    protected static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, int status)
    {
        var body = await response.Content.ReadAsStringAsync();
        ((int)response.StatusCode).Should().Be(status, body);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        return JsonDocument.Parse(body).RootElement;
    }
}
