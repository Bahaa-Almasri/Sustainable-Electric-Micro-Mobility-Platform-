using Microsoft.IdentityModel.JsonWebTokens;

namespace MicroMobility.Services.CurrentUser;

/// <summary>The only way a service sees the caller. Services never take HttpContext.</summary>
public interface ICurrentUser
{
    string? Sub { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }

    /// <summary>The caller's user id. Throws UnauthorizedAccessException when there is none.</summary>
    Guid RequireUserId();
}

public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _http;

    public CurrentUser(IHttpContextAccessor http) => _http = http;

    public bool IsAuthenticated => _http.HttpContext?.User?.Identity?.IsAuthenticated == true;

    public string? Sub => _http.HttpContext?.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

    public string? Email => _http.HttpContext?.User?.FindFirst(JwtRegisteredClaimNames.Email)?.Value;

    public Guid RequireUserId() =>
        IsAuthenticated && Guid.TryParse(Sub, out var id)
            ? id
            : throw new UnauthorizedAccessException("You must be signed in.");
}
