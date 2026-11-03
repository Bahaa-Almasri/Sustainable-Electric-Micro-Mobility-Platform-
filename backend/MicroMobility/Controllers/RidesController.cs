using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroMobility.DTOs;
using MicroMobility.Services.Pricing;
using MicroMobility.Services.RideService;

namespace MicroMobility.Controllers;

[ApiController]
[Route("rides")]
[Authorize]
public sealed class RidesController : ControllerBase
{
    private readonly IRideService _rides;
    private readonly IPricingService _pricing;

    public RidesController(IRideService rides, IPricingService pricing)
    {
        _rides = rides;
        _pricing = pricing;
    }

    [HttpGet("me")]
    public async Task<ActionResult<IReadOnlyList<RideResponse>>> Mine(CancellationToken cancellationToken)
        => Ok(await _rides.ListMineAsync(cancellationToken));

    /// <summary>The caller's active ride, or JSON null when there is none.</summary>
    [HttpGet("me/active")]
    public async Task<ActionResult<RideResponse?>> Active(CancellationToken cancellationToken)
        => Ok(await _rides.GetActiveAsync(cancellationToken));

    /// <summary>Resolved rates for every vehicle type (database first, then defaults).</summary>
    [HttpGet("pricing/catalog")]
    public async Task<ActionResult<PricingCatalogResponse>> PricingCatalog(CancellationToken cancellationToken)
        => Ok(new PricingCatalogResponse(await _pricing.GetCatalogAsync(cancellationToken)));

    [HttpPost("start")]
    public async Task<ActionResult<StartRideResponse>> Start(
        [FromBody] StartRideRequest request, CancellationToken cancellationToken)
        => Ok(await _rides.StartAsync(request, cancellationToken));

    [HttpPost("end")]
    public async Task<ActionResult<EndRideResponse>> End(
        [FromBody] EndRideRequest request, CancellationToken cancellationToken)
        => Ok(await _rides.EndAsync(request, cancellationToken));
}
