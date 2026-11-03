using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroMobility.DTOs;
using MicroMobility.Services.Reservations;
using MicroMobility.Services.SupportService;
using MicroMobility.Services.WalletService;

namespace MicroMobility.Controllers;

[ApiController]
[Route("reservations")]
[Authorize]
public sealed class ReservationsController : ControllerBase
{
    private readonly IReservationService _reservations;

    public ReservationsController(IReservationService reservations) => _reservations = reservations;

    [HttpGet("me")]
    public async Task<ActionResult<IReadOnlyList<ReservationResponse>>> Mine(CancellationToken cancellationToken)
        => Ok(await _reservations.ListMineAsync(cancellationToken));

    [HttpPost("me")]
    public async Task<ActionResult<CreateReservationResponse>> Create(
        [FromBody] ReservationCreateRequest request, CancellationToken cancellationToken)
        => Ok(await _reservations.CreateAsync(request, cancellationToken));

    [HttpDelete("me/{reservationId:guid}")]
    public async Task<ActionResult<CancelReservationResponse>> Cancel(Guid reservationId, CancellationToken cancellationToken)
        => Ok(await _reservations.CancelAsync(reservationId, cancellationToken));
}

[ApiController]
[Route("wallet")]
[Authorize]
public sealed class WalletController : ControllerBase
{
    private readonly IWalletService _wallet;

    public WalletController(IWalletService wallet) => _wallet = wallet;

    [HttpGet("packages")]
    public async Task<ActionResult<IReadOnlyList<RidePackageResponse>>> Packages(CancellationToken cancellationToken)
        => Ok(await _wallet.ListPackagesAsync(cancellationToken));

    [HttpGet("overview")]
    public async Task<ActionResult<WalletOverviewResponse>> Overview(CancellationToken cancellationToken)
        => Ok(await _wallet.GetOverviewAsync(cancellationToken));

    [HttpPost("purchase")]
    public async Task<ActionResult<PurchasePackageResponse>> Purchase(
        [FromBody] PurchasePackageRequest request, CancellationToken cancellationToken)
        => Ok(await _wallet.PurchaseAsync(request, cancellationToken));
}

[ApiController]
[Route("support")]
[Authorize]
public sealed class SupportController : ControllerBase
{
    private readonly ISupportService _support;

    public SupportController(ISupportService support) => _support = support;

    [HttpGet("tickets")]
    public async Task<ActionResult<IReadOnlyList<SupportTicketResponse>>> Tickets(CancellationToken cancellationToken)
        => Ok(await _support.ListMineAsync(cancellationToken));

    [HttpPost("tickets")]
    public async Task<ActionResult<OkResponse>> Create(
        [FromBody] SupportTicketCreateRequest request, CancellationToken cancellationToken)
    {
        await _support.CreateAsync(request, cancellationToken);
        return Ok(new OkResponse(true));
    }
}
