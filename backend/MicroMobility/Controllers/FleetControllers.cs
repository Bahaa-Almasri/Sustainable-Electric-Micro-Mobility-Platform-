using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroMobility.DTOs;
using MicroMobility.Services.FleetService;
using MicroMobility.Services.ScreenService;

namespace MicroMobility.Controllers;

[ApiController]
[Route("vehicles")]
[Authorize]
public sealed class VehiclesController : ControllerBase
{
    private readonly IVehicleService _vehicles;
    private readonly IScreenService _screens;

    public VehiclesController(IVehicleService vehicles, IScreenService screens)
    {
        _vehicles = vehicles;
        _screens = screens;
    }

    /// <summary>Available vehicles with a known position.</summary>
    [HttpGet("available")]
    public async Task<ActionResult<IReadOnlyList<VehicleWithStateResponse>>> Available(CancellationToken cancellationToken)
        => Ok(await _vehicles.ListAvailableAsync(cancellationToken));

    [HttpGet("{vehicleId:guid}")]
    public async Task<ActionResult<VehicleWithStateResponse>> Get(Guid vehicleId, CancellationToken cancellationToken)
        => Ok(await _vehicles.GetAsync(vehicleId, cancellationToken));

    /// <summary>Everything the vehicle screen needs in one request.</summary>
    [HttpGet("{vehicleId:guid}/details")]
    public async Task<ActionResult<VehicleDetailsResponse>> Details(Guid vehicleId, CancellationToken cancellationToken)
        => Ok(await _screens.GetVehicleDetailsAsync(vehicleId, cancellationToken));
}

[ApiController]
[Route("stations")]
[Authorize]
public sealed class StationsController : ControllerBase
{
    private readonly IStationService _stations;

    public StationsController(IStationService stations) => _stations = stations;

    [HttpGet("active")]
    public async Task<ActionResult<IReadOnlyList<StationResponse>>> Active(CancellationToken cancellationToken)
        => Ok(await _stations.ListActiveAsync(cancellationToken));

    /// <summary>Stations with at least one free parking slot.</summary>
    [HttpGet("parking-available")]
    public async Task<ActionResult<IReadOnlyList<StationResponse>>> ParkingAvailable(CancellationToken cancellationToken)
        => Ok(await _stations.ListParkingAvailableAsync(cancellationToken));

    [HttpGet("{stationId:guid}/vehicles")]
    public async Task<ActionResult<IReadOnlyList<VehicleWithStateResponse>>> Vehicles(
        Guid stationId, CancellationToken cancellationToken)
        => Ok(await _stations.ListVehiclesAsync(stationId, cancellationToken));
}

[ApiController]
[Route("map")]
[Authorize]
public sealed class MapController : ControllerBase
{
    private readonly IScreenService _screens;

    public MapController(IScreenService screens) => _screens = screens;

    /// <summary>Everything the map screen needs in one request.</summary>
    [HttpGet("overview")]
    public async Task<ActionResult<MapOverviewResponse>> Overview(CancellationToken cancellationToken)
        => Ok(await _screens.GetMapOverviewAsync(cancellationToken));
}
