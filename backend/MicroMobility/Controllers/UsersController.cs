using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroMobility.DTOs;
using MicroMobility.Services.ScreenService;
using MicroMobility.Services.UserService;

namespace MicroMobility.Controllers;

[ApiController]
[Route("users")]
[Authorize]
public sealed class UsersController : ControllerBase
{
    private readonly IUserService _users;
    private readonly IScreenService _screens;

    public UsersController(IUserService users, IScreenService screens)
    {
        _users = users;
        _screens = screens;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
        => Ok(await _users.GetMeAsync(cancellationToken));

    /// <summary>Everything the account screen needs in one request.</summary>
    [HttpGet("me/summary")]
    public async Task<ActionResult<AccountSummaryResponse>> Summary(CancellationToken cancellationToken)
        => Ok(await _screens.GetAccountSummaryAsync(cancellationToken));

    /// <summary>A user's own profile by id; anyone else's is a 403.</summary>
    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<UserResponse>> Get(Guid userId, CancellationToken cancellationToken)
        => Ok(await _users.GetAsync(userId, cancellationToken));
}
