namespace MicroMobility.Services.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// HS256 signing secret, at least 32 bytes. Changing it signs every user out: tokens already
    /// issued (claims: sub, email, exp) only validate against the secret that signed them.
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    public int ExpireDays { get; set; } = 7;
}
