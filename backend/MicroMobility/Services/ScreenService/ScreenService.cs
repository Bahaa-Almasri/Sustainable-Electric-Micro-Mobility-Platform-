using MicroMobility.DTOs;
using MicroMobility.Exceptions;
using MicroMobility.Services.FleetService;
using MicroMobility.Services.Pricing;
using MicroMobility.Services.Reservations;
using MicroMobility.Services.RideService;
using MicroMobility.Services.UserService;
using MicroMobility.Services.WalletService;

namespace MicroMobility.Services.ScreenService;

/// <summary>One request per screen instead of several (map, account, vehicle).</summary>
public interface IScreenService
{
    Task<MapOverviewResponse> GetMapOverviewAsync(CancellationToken cancellationToken);
    Task<AccountSummaryResponse> GetAccountSummaryAsync(CancellationToken cancellationToken);
    Task<VehicleDetailsResponse> GetVehicleDetailsAsync(Guid vehicleId, CancellationToken cancellationToken);
}

public sealed class ScreenService : IScreenService
{
    private readonly IRideService _rides;
    private readonly IPricingService _pricing;
    private readonly IStationService _stations;
    private readonly IVehicleService _vehicles;
    private readonly IUserService _users;
    private readonly IReservationService _reservations;
    private readonly IWalletService _wallet;
    private readonly ILogger<ScreenService> _logger;

    public ScreenService(
        IRideService rides,
        IPricingService pricing,
        IStationService stations,
        IVehicleService vehicles,
        IUserService users,
        IReservationService reservations,
        IWalletService wallet,
        ILogger<ScreenService> logger)
    {
        _rides = rides;
        _pricing = pricing;
        _stations = stations;
        _vehicles = vehicles;
        _users = users;
        _reservations = reservations;
        _wallet = wallet;
        _logger = logger;
    }

    // Sections run one after another: they share one scoped DbContext, which is not thread-safe.
    // One round trip per section is still far cheaper than the HTTP round trips this replaces.

    public async Task<MapOverviewResponse> GetMapOverviewAsync(CancellationToken cancellationToken)
    {
        var sections = new SectionLoader(_logger, "map screen");
        var activeRide = await sections.TryAsync("active_ride", () => _rides.GetActiveAsync(cancellationToken));
        var pricing = await sections.TryAsync("pricing", () => _pricing.GetCatalogAsync(cancellationToken));

        IReadOnlyList<StationResponse> stations = [];
        IReadOnlyList<StationResponse> parkingStations = [];
        if (activeRide is not null)
        {
            parkingStations = await sections.TryAsync("parking_stations",
                () => _stations.ListParkingAvailableAsync(cancellationToken)) ?? [];
        }
        else
        {
            stations = await sections.TryAsync("stations", () => _stations.ListActiveAsync(cancellationToken)) ?? [];
        }

        return new MapOverviewResponse(activeRide, pricing, stations, parkingStations, sections.Errors, DateTime.UtcNow);
    }

    public async Task<AccountSummaryResponse> GetAccountSummaryAsync(CancellationToken cancellationToken)
    {
        var profile = await _users.GetMeAsync(cancellationToken);     // required: failure fails the request

        var sections = new SectionLoader(_logger, "account screen");
        var rides = await sections.TryAsync("rides", () => _rides.ListMineAsync(cancellationToken));
        var reservations = await sections.TryAsync("reservations", () => _reservations.ListMineAsync(cancellationToken));
        var wallet = await sections.TryAsync("wallet", () => _wallet.GetOverviewAsync(cancellationToken));

        return new AccountSummaryResponse(profile, rides, reservations, wallet, sections.Errors, DateTime.UtcNow);
    }

    public async Task<VehicleDetailsResponse> GetVehicleDetailsAsync(Guid vehicleId, CancellationToken cancellationToken)
    {
        var vehicle = await _vehicles.GetAsync(vehicleId, cancellationToken);   // required: 404 if missing

        var sections = new SectionLoader(_logger, "vehicle screen");
        var reservations = await sections.TryAsync("reservations", () => _reservations.ListMineAsync(cancellationToken));
        var pricing = await sections.TryAsync("pricing", () => _pricing.GetCatalogAsync(cancellationToken));

        var mine = reservations?.Where(r => r.VehicleId == vehicleId).ToList();
        return new VehicleDetailsResponse(vehicle, mine, pricing, sections.Errors, DateTime.UtcNow);
    }
}

/// <summary>
/// Loads the optional parts of a screen. A part that fails is logged, reported under its name in
/// <see cref="Errors"/> and returned as null, so one broken section never costs the whole screen.
/// </summary>
public sealed class SectionLoader(ILogger logger, string screen)
{
    private readonly Dictionary<string, string> _errors = new();

    public IReadOnlyDictionary<string, string> Errors => _errors;

    public async Task<T?> TryAsync<T>(string section, Func<Task<T>> load) where T : class?
    {
        try
        {
            return await load();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Client-facing failures keep their sentence; anything else gets a generic one.
            var expected = exception is ArgumentException or KeyNotFoundException
                or UnauthorizedAccessException or ConflictException;
            if (expected)
            {
                logger.LogWarning("The {Section} section of the {Screen} failed: {Message}", section, screen, exception.Message);
            }
            else
            {
                logger.LogError(exception, "The {Section} section of the {Screen} failed and was left out.", section, screen);
            }
            _errors[section] = expected ? exception.Message : $"Failed to load {section}";
            return null;
        }
    }
}
