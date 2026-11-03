namespace MicroMobility.Configuration;

/// <summary>
/// CORS settings for browser clients (Expo web). Native iOS/Android builds do not use CORS but
/// share the same API host configuration.
/// </summary>
public sealed class CorsOptions
{
    public const string SectionName = "Cors";

    /// <summary>Explicit allowed origins. In Development, localhost and private-LAN origins are also allowed.</summary>
    public string[] AllowedOrigins { get; set; } = [];
}
