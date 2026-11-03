using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Hangfire.Annotations;
using Hangfire.Dashboard;

namespace MicroMobility.Authorization;

/// <summary>
/// Guards /hangfire, which can requeue, trigger and delete jobs and prints job arguments.
/// </summary>
/// <remarks>
/// Development is open (reachable only from the machine running the app). Anywhere else it requires
/// HTTP Basic credentials from Hangfire:Dashboard:Username/Password, and refuses everyone if those
/// are unset. Deliberately not "local requests only": behind a reverse proxy every request looks local.
/// </remarks>
public sealed class HangfireDashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    private const string Realm = "micromobility jobs";

    private readonly bool _allowAnonymous;
    private readonly string? _username;
    private readonly string? _password;

    public HangfireDashboardAuthorizationFilter(bool allowAnonymous, string? username, string? password)
    {
        _allowAnonymous = allowAnonymous;
        _username = username;
        _password = password;
    }

    public bool Authorize([NotNull] DashboardContext context)
    {
        if (_allowAnonymous) return true;

        // Nothing to check against: fail closed rather than fall back to an open dashboard.
        if (string.IsNullOrWhiteSpace(_username) || string.IsNullOrWhiteSpace(_password)) return false;

        var httpContext = context.GetHttpContext();
        if (IsAuthorized(httpContext.Request.Headers.Authorization, _username, _password)) return true;

        // Without the challenge the browser has no way to offer a credential prompt.
        httpContext.Response.Headers.WWWAuthenticate = $"Basic realm=\"{Realm}\", charset=\"UTF-8\"";
        return false;
    }

    /// <summary>Split out so it can be unit-tested without a Hangfire context.</summary>
    public static bool IsAuthorized(string? authorizationHeader, string username, string password)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader)
            || !AuthenticationHeaderValue.TryParse(authorizationHeader, out var header)
            || !string.Equals(header.Scheme, "Basic", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(header.Parameter))
        {
            return false;
        }

        string decoded;
        try { decoded = Encoding.UTF8.GetString(Convert.FromBase64String(header.Parameter)); }
        catch (FormatException) { return false; }

        var separator = decoded.IndexOf(':');
        if (separator < 0) return false;

        // Fixed-time comparison on both halves with a non-short-circuiting `&`: a length or prefix
        // leak here would be a credential oracle.
        return FixedTimeEquals(decoded[..separator], username)
             & FixedTimeEquals(decoded[(separator + 1)..], password);
    }

    private static bool FixedTimeEquals(string left, string right) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));
}
