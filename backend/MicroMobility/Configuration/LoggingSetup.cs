using Microsoft.AspNetCore.Connections;
using Microsoft.IdentityModel.JsonWebTokens;
using Serilog;
using Serilog.AspNetCore;
using Serilog.Events;

namespace MicroMobility.Configuration;

/// <summary>Where log files go. Relative paths resolve against the project (content root) folder.</summary>
public sealed class LogFileOptions
{
    public const string SectionName = "LogFiles";

    public bool Enabled { get; set; } = true;

    /// <summary>Serilog inserts the date before the extension: logs/micromobility-20261103.log.</summary>
    public string Path { get; set; } = "logs/micromobility-.log";

    /// <summary>Daily files kept; older ones are deleted.</summary>
    public int RetainedDays { get; set; } = 14;
}

/// <summary>
/// Logging for the API: the console for live work, rolling daily files for after the fact, one
/// line per HTTP request, and a request id on every line so one request's story can be pulled out
/// of the file. Minimum levels come from the "Serilog" section of appsettings.
/// </summary>
public static class LoggingSetup
{
    // {RequestId} is HttpContext.TraceIdentifier: the same value as the X-Request-Id response
    // header and the trace_id in a 500 response body. Empty for lines outside a request.
    private const string ConsoleTemplate =
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}";

    private const string FileTemplate =
        "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{RequestId}] {SourceContext}: {Message:lj}{NewLine}{Exception}";

    public static LoggerConfiguration Configure(
        this LoggerConfiguration logger, IConfiguration configuration, IHostEnvironment environment)
    {
        logger
            .ReadFrom.Configuration(configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console(outputTemplate: ConsoleTemplate);

        var files = configuration.GetSection(LogFileOptions.SectionName).Get<LogFileOptions>() ?? new LogFileOptions();
        if (files.Enabled)
        {
            logger.WriteTo.File(
                ResolvePath(files.Path, environment),
                outputTemplate: FileTemplate,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: Math.Max(1, files.RetainedDays),
                fileSizeLimitBytes: 50 * 1024 * 1024,
                rollOnFileSizeLimit: true,
                // Lets you open/tail the file while the API writes to it.
                shared: true);
        }

        return logger;
    }

    /// <summary>
    /// One line per request: "HTTP POST /rides/start responded 409 in 42 ms". The path never
    /// includes the query string, so the hub's ?access_token= stays out of the logs; no headers
    /// or bodies are logged.
    /// </summary>
    public static void ConfigureRequestLogging(RequestLoggingOptions options)
    {
        options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0} ms";

        options.GetLevel = (context, _, exception) =>
        {
            // Probes, realtime long-polling and the Hangfire dashboard's self-polling would bury
            // everything else; they are logged at Verbose (hidden at the default level).
            var path = context.Request.Path;
            if (path.StartsWithSegments("/health") || path.StartsWithSegments("/hubs") || path.StartsWithSegments("/hangfire"))
            {
                return LogEventLevel.Verbose;
            }
            return exception is not null || context.Response.StatusCode >= 500
                ? LogEventLevel.Error
                : LogEventLevel.Information;
        };

        options.EnrichDiagnosticContext = (diagnostics, context) =>
        {
            diagnostics.Set("UserId", context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? "anonymous");
            diagnostics.Set("ClientIp", context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        };
    }

    /// <summary>
    /// Writes a startup failure (port taken, bad config, unreachable database) to the console and
    /// the log file, with a plain-language hint for the common causes.
    /// </summary>
    public static void LogStartupFailure(Exception exception, IConfiguration configuration, IHostEnvironment environment)
    {
        using var logger = new LoggerConfiguration().Configure(configuration, environment).CreateLogger();

        var hint = FindInChain<AddressInUseException>(exception) is not null
            ? $"The port in App:Url ({configuration["App:Url"]}) is already in use — is another copy of the backend "
              + "or another server still running on it? Stop it, or start this one with a different App__Url."
            : FindInChain<Npgsql.NpgsqlException>(exception) is not null
                ? "Could not use the database. Check ConnectionStrings:DefaultConnection in appsettings.Development.json "
                  + "(the full Neon postgresql:// URI, with your real role and password)."
                : "The API could not start.";

        logger.Fatal(exception, "Startup failed. {Hint}", hint);
    }

    private static string ResolvePath(string path, IHostEnvironment environment) =>
        System.IO.Path.IsPathRooted(path) ? path : System.IO.Path.Combine(environment.ContentRootPath, path);

    private static T? FindInChain<T>(Exception exception) where T : Exception
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is T match) return match;
            if (current is AggregateException aggregate)
            {
                foreach (var inner in aggregate.InnerExceptions)
                {
                    if (FindInChain<T>(inner) is { } found) return found;
                }
            }
        }
        return null;
    }
}
