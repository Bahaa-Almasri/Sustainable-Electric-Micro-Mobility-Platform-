namespace MicroMobility.Configuration;

public static class RateLimitPolicies
{
    /// <summary>Anonymous sign-up and sign-in: partitioned per IP, since there is no user yet.</summary>
    public const string Auth = "auth";
}

public sealed class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Requests per minute per signed-in user (else per IP) across the API. A broad scraping net.</summary>
    public int GlobalPermitLimit { get; set; } = 200;

    /// <summary>Register/login attempts per minute per IP. Slows password guessing and sign-up spam.</summary>
    public int AuthPermitLimit { get; set; } = 10;
}
