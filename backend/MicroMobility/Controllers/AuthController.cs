using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MicroMobility.Configuration;
using MicroMobility.DTOs;
using MicroMobility.Services.UserService;

namespace MicroMobility.Controllers;

[ApiController]
[Route("auth")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.Auth)]
public sealed class AuthController : ControllerBase
{
    private readonly IUserService _users;

    public AuthController(IUserService users) => _users = users;

    /// <summary>Creates an account and signs it in.</summary>
    [HttpPost("register")]
    public async Task<ActionResult<TokenResponse>> Register(
        [FromBody] RegisterRequest request, CancellationToken cancellationToken)
        => Ok(await _users.RegisterAsync(request, cancellationToken));

    /// <summary>Exchanges email + password for an access token.</summary>
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login(
        [FromBody] LoginRequest request, CancellationToken cancellationToken)
        => Ok(await _users.LoginAsync(request, cancellationToken));
}
