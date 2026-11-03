using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace MicroMobility.Services.Auth;

public interface ITokenService
{
    /// <summary>Issues an access token for a signed-in user.</summary>
    AccessToken Issue(Guid userId, string? email);
}

public sealed record AccessToken(string Value, DateTime ExpiresAt);

public sealed class JwtTokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly JsonWebTokenHandler _handler = new() { SetDefaultTimesOnTokenCreation = false };

    public JwtTokenService(IOptions<JwtOptions> options) => _options = options.Value;

    public AccessToken Issue(Guid userId, string? email)
    {
        var expiresAt = DateTime.UtcNow.AddDays(_options.ExpireDays);
        var claims = new Dictionary<string, object> { [JwtRegisteredClaimNames.Sub] = userId.ToString() };
        if (!string.IsNullOrWhiteSpace(email)) claims[JwtRegisteredClaimNames.Email] = email;

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Claims = claims,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(CreateSigningKey(_options.Secret), SecurityAlgorithms.HmacSha256)
        });
        return new AccessToken(token, expiresAt);
    }

    /// <summary>Shared with the JwtBearer validation setup so issuing and validating use the same key.</summary>
    public static SymmetricSecurityKey CreateSigningKey(string secret) => new(Encoding.UTF8.GetBytes(secret));

    /// <summary>
    /// Validation rules: HS256 only, a required exp with no clock leeway, no issuer or audience —
    /// the shape of every token issued so far, so existing sessions stay valid.
    /// </summary>
    public static TokenValidationParameters CreateValidationParameters(string secret) => new()
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        ClockSkew = TimeSpan.Zero,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = CreateSigningKey(secret),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        NameClaimType = JwtRegisteredClaimNames.Sub
    };
}
