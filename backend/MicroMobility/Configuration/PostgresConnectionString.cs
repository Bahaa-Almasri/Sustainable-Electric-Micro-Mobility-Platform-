using Npgsql;

namespace MicroMobility.Configuration;

/// <summary>
/// Accepts either an Npgsql keyword string ("Host=...;Username=...") or the libpq URI Neon's
/// dashboard hands out ("postgresql://role:password@host/db?sslmode=require&amp;channel_binding=require"),
/// and always returns a keyword string. Npgsql itself does not parse URIs.
/// </summary>
public static class PostgresConnectionString
{
    private static readonly Dictionary<string, Action<NpgsqlConnectionStringBuilder, string>> QueryParameters =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["sslmode"] = (b, v) => b.SslMode = Enum.Parse<SslMode>(v.Replace("-", string.Empty), ignoreCase: true),
            ["channel_binding"] = (b, v) => b.ChannelBinding = Enum.Parse<ChannelBinding>(v, ignoreCase: true),
            ["connect_timeout"] = (b, v) => b.Timeout = int.Parse(v),
            ["application_name"] = (b, v) => b.ApplicationName = v,
            ["options"] = (b, v) => b.Options = v,
        };

    public static string Normalize(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured. Set it in appsettings.Development.json "
                + "or the ConnectionStrings__DefaultConnection environment variable.");
        }

        var trimmed = connectionString.Trim();
        if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        var uri = new Uri(trimmed);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
        };

        var userInfo = uri.UserInfo;
        if (!string.IsNullOrEmpty(userInfo))
        {
            var separator = userInfo.IndexOf(':');
            builder.Username = Uri.UnescapeDataString(separator < 0 ? userInfo : userInfo[..separator]);
            if (separator >= 0) builder.Password = Uri.UnescapeDataString(userInfo[(separator + 1)..]);
        }

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separator = pair.IndexOf('=');
            var key = Uri.UnescapeDataString(separator < 0 ? pair : pair[..separator]);
            var value = separator < 0 ? string.Empty : Uri.UnescapeDataString(pair[(separator + 1)..]);

            // Refuse rather than ignore: silently dropping e.g. sslrootcert would weaken the connection.
            if (!QueryParameters.TryGetValue(key, out var apply))
            {
                throw new InvalidOperationException(
                    $"Unsupported connection URI parameter '{key}'. Use an Npgsql keyword connection string instead.");
            }

            apply(builder, value);
        }

        return builder.ConnectionString;
    }
}
