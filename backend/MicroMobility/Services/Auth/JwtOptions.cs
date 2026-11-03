namespace MicroMobility.Services.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// HS256 signing secret, at least 32 bytes. Keep the value the Python API used and every token
    /// it issued stays valid (same algorithm, same claims: sub, email, exp).
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    public int ExpireDays { get; set; } = 7;
}
