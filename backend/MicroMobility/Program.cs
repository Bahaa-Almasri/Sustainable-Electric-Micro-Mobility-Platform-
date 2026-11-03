using System.Net;
using System.Threading.RateLimiting;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.OpenApi.Models;
using MicroMobility.Authorization;
using MicroMobility.Configuration;
using MicroMobility.Data;
using MicroMobility.Exceptions;
using MicroMobility.Hubs;
using MicroMobility.Middleware;
using MicroMobility.Services.Auth;
using MicroMobility.Services.CurrentUser;
using MicroMobility.Services.FleetService;
using MicroMobility.Services.Pricing;
using MicroMobility.Services.Realtime;
using MicroMobility.Services.Reservations;
using MicroMobility.Services.RideService;
using MicroMobility.Services.ScreenService;
using MicroMobility.Services.SupportService;
using MicroMobility.Services.UserService;
using MicroMobility.Services.WalletService;
using CorsOptions = MicroMobility.Configuration.CorsOptions;

var builder = WebApplication.CreateBuilder(args);
const string AppCorsPolicy = "AppCors";
const string HubPath = "/hubs/notifications";

// ---------------------------------------------------------------------------
// Local helpers (CORS + rate-limit partitioning)
// ---------------------------------------------------------------------------

static bool IsPrivateLanHost(string host)
{
    if (!IPAddress.TryParse(host, out var ip)) return false;
    if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
    var bytes = ip.GetAddressBytes();
    if (bytes.Length != 4) return false;
    if (bytes[0] == 10) return true;
    if (bytes[0] == 192 && bytes[1] == 168) return true;
    return bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31;
}

// In development, allow localhost (any port — Expo web moves around) and private-LAN origins, so a
// phone or another machine on the same Wi-Fi reaches the dev server without editing config.
static bool IsDevelopmentOriginAllowed(string origin, IReadOnlyCollection<string> configured)
{
    if (string.IsNullOrWhiteSpace(origin)) return false;
    if (configured.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
    if (uri.Scheme is not ("http" or "https")) return false;
    if (uri.Host is "localhost" or "127.0.0.1") return true;
    return IsPrivateLanHost(uri.Host);
}

// Per signed-in user when known, otherwise per IP.
static string GetRateLimitPartitionKey(HttpContext context)
{
    var sub = context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
    return !string.IsNullOrWhiteSpace(sub)
        ? $"user:{sub}"
        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}

static RateLimitPartition<string> FixedWindow(string key, int permitLimit) =>
    RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = permitLimit,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0
    });

static Task WriteProblemAsync(HttpContext context, int status, string title, string detail, string code)
{
    context.Response.StatusCode = status;
    var problem = new ProblemDetails { Status = status, Title = title, Detail = detail, Instance = context.Request.Path };
    problem.Extensions["code"] = code;
    return context.Response.WriteAsJsonAsync(problem, (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json");
}

// ---------------------------------------------------------------------------
// MVC / JSON / SignalR / error handling
// ---------------------------------------------------------------------------

builder.Services.AddControllers(options =>
    {
        // GET /rides/me/active answers JSON `null` when there is no ride, as the app expects,
        // instead of MVC's default 204 for a null result.
        options.OutputFormatters.RemoveType<HttpNoContentOutputFormatter>();
    })
    .AddJsonOptions(options => JsonSetup.Apply(options.JsonSerializerOptions))
    .ConfigureApiBehaviorOptions(options =>
    {
        // Malformed bodies (bad JSON, a non-UUID id) become the same ProblemDetails as every other
        // error, with a `detail` sentence the app can show.
        options.InvalidModelStateResponseFactory = context =>
        {
            var invalid = context.ModelState.Where(entry => entry.Value?.Errors.Count > 0).ToList();
            // A bad field also marks the whole body ("request") invalid; report the field alone.
            if (invalid.Any(entry => entry.Key.StartsWith('$')))
            {
                invalid = invalid.Where(entry => entry.Key.StartsWith('$')).ToList();
            }

            var messages = invalid
                .Select(entry =>
                {
                    var field = entry.Key.TrimStart('$', '.');
                    var error = entry.Value!.Errors[0];
                    var message = error.Exception is not null || error.ErrorMessage.StartsWith("The JSON value", StringComparison.Ordinal)
                        ? "has an invalid value"
                        : error.ErrorMessage;
                    return string.IsNullOrEmpty(field) || field == "request" ? message : $"{field}: {message}";
                })
                .ToList();

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad request",
                Detail = messages.Count > 0 ? string.Join("; ", messages) : "The request is not valid.",
                Instance = context.HttpContext.Request.Path
            };
            problem.Extensions["code"] = ErrorCodes.ValidationFailed;
            return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
        };
    });
builder.Services.ConfigureHttpJsonOptions(options => JsonSetup.Apply(options.SerializerOptions));

builder.Services.AddSignalR(options =>
    {
        options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    })
    .AddJsonProtocol(options => JsonSetup.Apply(options.PayloadSerializerOptions));
builder.Services.AddSingleton<IUserIdProvider, SubUserIdProvider>();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    // Behind an ingress that terminates TLS. The proxy is only reachable inside the platform
    // network, so its address is not pinned.
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

var corsOrigins = builder.Configuration
    .GetSection(CorsOptions.SectionName)
    .Get<CorsOptions>()
    ?.AllowedOrigins
    ?.Where(o => !string.IsNullOrWhiteSpace(o))
    .Select(o => o.Trim())
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(AppCorsPolicy, policy =>
    {
        // SignalR's browser client sends credentials; AllowAnyOrigin() is incompatible with that.
        policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();

        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin => IsDevelopmentOriginAllowed(origin, corsOrigins));
        }
        else if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins);
        }
        else
        {
            // Fail at startup rather than ship an API with no origin policy.
            throw new InvalidOperationException(
                "Cors:AllowedOrigins must be configured for non-development environments.");
        }
    });
});

// ---------------------------------------------------------------------------
// Authentication: the app's own HS256 access tokens (sub = user id, email, exp)
// ---------------------------------------------------------------------------

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(x => System.Text.Encoding.UTF8.GetByteCount(x.Secret ?? string.Empty) >= 32,
        "Jwt:Secret must be at least 32 bytes. Set it in appsettings.Development.json or the Jwt__Secret environment variable.")
    .Validate(x => x.ExpireDays is >= 1 and <= 365, "Jwt:ExpireDays must be between 1 and 365.")
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwt) =>
    {
        // Keep "sub"/"email" as-is instead of remapping them to long WS-* claim URIs.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = JwtTokenService.CreateValidationParameters(jwt.Value.Secret);
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // WebSocket/SSE clients cannot send headers, so SignalR passes the token in the
                // query string. Honoured only on the hub path, to keep tokens out of other URLs/logs.
                if (context.HttpContext.Request.Path.StartsWithSegments(HubPath))
                {
                    var token = context.Request.Query["access_token"].ToString();
                    if (!string.IsNullOrWhiteSpace(token)) context.Token = token;
                }
                return Task.CompletedTask;
            },
            OnChallenge = async context =>
            {
                // Same ProblemDetails shape as every other error, instead of an empty 401.
                context.HandleResponse();
                var invalid = context.AuthenticateFailure is not null;
                await WriteProblemAsync(context.HttpContext, StatusCodes.Status401Unauthorized, "Unauthorized",
                    invalid ? "Invalid or expired token" : "Not authenticated",
                    invalid ? ErrorCodes.InvalidToken : ErrorCodes.NotAuthenticated);
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Everything requires a signed-in user unless it opts out with [AllowAnonymous].
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

var rateLimits = builder.Configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>()
    ?? new RateLimitOptions();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) => new ValueTask(WriteProblemAsync(context.HttpContext,
        StatusCodes.Status429TooManyRequests, "Too many requests",
        "Too many requests. Please wait a moment and try again.", ErrorCodes.RateLimited));

    // /hubs is exempt so long-lived realtime connections and their reconnects are never
    // throttled; /hangfire because its dashboard polls itself while open.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path.StartsWithSegments("/hubs")
            ? RateLimitPartition.GetNoLimiter("hubs")
            : context.Request.Path.StartsWithSegments("/hangfire")
                ? RateLimitPartition.GetNoLimiter("hangfire")
                : FixedWindow(GetRateLimitPartitionKey(context), rateLimits.GlobalPermitLimit));

    options.AddPolicy(RateLimitPolicies.Auth, context => FixedWindow(
        $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}", rateLimits.AuthPermitLimit));
});

// ---------------------------------------------------------------------------
// Database (Neon PostgreSQL) + background jobs (same database, Hangfire owns schema "hangfire")
// ---------------------------------------------------------------------------

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => options.UseAppNpgsql(connectionString));

// Off in tests, which run job classes directly instead of waiting on a scheduler.
var hangfireEnabled = builder.Configuration.GetValue("Hangfire:Enabled", true);

// Booking jobs and running them are separate switches, so one image can deploy as a web role
// (books) and a worker role (runs). On by default: a single process does both.
var hangfireServerEnabled = hangfireEnabled && builder.Configuration.GetValue("Hangfire:Server:Enabled", true);

if (hangfireEnabled)
{
    var hangfireConnection = PostgresConnectionString.Normalize(connectionString);
    builder.Services.AddHangfire(config => config
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(
            storage => storage.UseNpgsqlConnection(hangfireConnection),
            new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire",
                PrepareSchemaIfNecessary = true,
                // How often idle workers poll for new jobs. Every poll is a query against Neon,
                // which keeps the compute awake while the API runs; 15 s is Hangfire's default.
                QueuePollInterval = TimeSpan.FromSeconds(15)
            }));
}

if (hangfireServerEnabled)
{
    // Keep: job timeout < this < the platform's grace period. Hangfire's own default is 15 s.
    var jobShutdownTimeout = TimeSpan.FromSeconds(Math.Clamp(
        builder.Configuration.GetValue("Hangfire:Server:ShutdownTimeoutSeconds", 60), 15, 3600));
    // The jobs here are short and I/O-bound; a small pool keeps idle polling (and Neon load) low.
    var jobWorkerCount = builder.Configuration.GetValue("Hangfire:Server:WorkerCount", 0);

    builder.Services.AddHangfireServer(options =>
    {
        options.ShutdownTimeout = jobShutdownTimeout;
        if (jobWorkerCount > 0) options.WorkerCount = jobWorkerCount;
    });

    // The host would otherwise kill the process after 30 s with Hangfire still draining.
    builder.Services.Configure<HostOptions>(options =>
        options.ShutdownTimeout = jobShutdownTimeout + TimeSpan.FromSeconds(10));
}

// ---------------------------------------------------------------------------
// Options binding
// ---------------------------------------------------------------------------

builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection(CorsOptions.SectionName));
builder.Services.AddOptions<ReservationOptions>()
    .Bind(builder.Configuration.GetSection(ReservationOptions.SectionName))
    .Validate(x => x.MinTtlMinutes >= 1 && x.MaxTtlMinutes >= x.MinTtlMinutes
                   && x.DefaultTtlMinutes >= x.MinTtlMinutes && x.DefaultTtlMinutes <= x.MaxTtlMinutes,
        "Reservations: need 1 <= MinTtlMinutes <= DefaultTtlMinutes <= MaxTtlMinutes.")
    .ValidateOnStart();

// ---------------------------------------------------------------------------
// Swagger / OpenAPI, documenting the bearer scheme so "Authorize" works in the UI
// ---------------------------------------------------------------------------

builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Micro-mobility API", Version = "v1" });
    var xmlDocs = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    // Opened as a stream: the path overload parses the path as a URI, which fails for some
    // perfectly valid Windows paths (and then breaks every request that touches Swagger options).
    if (File.Exists(xmlDocs))
    {
        c.IncludeXmlComments(() =>
        {
            using var stream = File.OpenRead(xmlDocs);
            return new System.Xml.XPath.XPathDocument(stream);
        });
    }

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Access token from POST /auth/login. Paste the token only."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new List<string>()
        }
    });
});

// ---------------------------------------------------------------------------
// Application services
// ---------------------------------------------------------------------------

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddSingleton<ITokenService, JwtTokenService>();
builder.Services.AddSingleton<INotificationNotifier, NotificationNotifier>();

builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<FleetService>();
builder.Services.AddScoped<IVehicleService>(sp => sp.GetRequiredService<FleetService>());
builder.Services.AddScoped<IStationService>(sp => sp.GetRequiredService<FleetService>());
builder.Services.AddScoped<IPricingService, PricingService>();
builder.Services.AddScoped<IRideService, RideService>();
builder.Services.AddScoped<IReservationService, ReservationService>();
builder.Services.AddScoped<IReservationExpiry, ReservationExpiry>();
builder.Services.AddScoped<IWalletService, WalletService>();
builder.Services.AddScoped<ISupportService, SupportService>();
builder.Services.AddScoped<IScreenService, ScreenService>();
builder.Services.AddScoped<ReservationExpirySweepJob>();     // Hangfire jobs are plain scoped classes

// With Hangfire, the sweep job keeps reservations fresh; without it, reads expire them inline.
if (hangfireEnabled) builder.Services.AddScoped<IReservationFreshness, ScheduledReservationFreshness>();
else builder.Services.AddScoped<IReservationFreshness, InlineReservationFreshness>();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Database migrations. Must run before Hangfire starts and before the first request.
// ---------------------------------------------------------------------------

var migrateOnly = args.Contains("--migrate-only");
if (migrateOnly || app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await DatabaseMigrator.MigrateAsync(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseMigrator"));
}

// The release step: apply migrations and exit before any replica starts serving.
if (migrateOnly) return;

// ---------------------------------------------------------------------------
// PIPELINE — order matters.
// ---------------------------------------------------------------------------

// FIRST: everything after it must see the original scheme and the caller's real IP.
app.UseForwardedHeaders();

app.UseExceptionHandler();   // hands off to GlobalExceptionHandler

if (app.Environment.IsDevelopment())
{
    // Development only: the schema is a map of the API for anyone who asks.
    app.MapOpenApi().AllowAnonymous();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseCors(AppCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// After authentication, so the partition key can use the signed-in user.
app.UseRateLimiter();

// The schedule is owned by the role that runs it.
if (hangfireServerEnabled)
{
    app.Services.GetRequiredService<IRecurringJobManager>().AddOrUpdate<ReservationExpirySweepJob>(
        ReservationExpirySweepJob.RecurringJobId,
        job => job.RunAsync(CancellationToken.None),
        Cron.Minutely());
}

// Liveness for platform probes: no auth, no rate limit, no database round trip.
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous().DisableRateLimiting();

if (app.Environment.IsDevelopment())
{
    // Development only: which database the API is connected to, and the users table it sees.
    app.MapGet("/health/db", async (AppDbContext db, CancellationToken ct) =>
    {
        var info = await db.Database
            .SqlQueryRaw<DbInfo>("SELECT current_database() AS \"Database\", current_user AS \"ConnectedAs\"")
            .SingleAsync(ct);
        var columns = await db.Database
            .SqlQueryRaw<DbColumn>("""
                SELECT column_name AS "Name", data_type AS "Type", is_nullable AS "Nullable"
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                ORDER BY ordinal_position
                """)
            .ToListAsync(ct);
        return Results.Ok(new { info.Database, info.ConnectedAs, PublicUsersColumns = columns });
    }).AllowAnonymous();
}

if (hangfireEnabled)
{
    // Mapped as an endpoint so it can opt out of the sign-in fallback policy: the dashboard is
    // guarded by its own filter (open in Development, HTTP Basic elsewhere), not by app tokens.
    var dashboard = app.Configuration.GetSection("Hangfire:Dashboard");
    app.MapHangfireDashboard("/hangfire", new DashboardOptions
    {
        DashboardTitle = "micro-mobility jobs",
        Authorization =
        [
            new HangfireDashboardAuthorizationFilter(
                app.Environment.IsDevelopment(), dashboard["Username"], dashboard["Password"])
        ]
    }).AllowAnonymous();
}

app.MapControllers().RequireCors(AppCorsPolicy);

// Only a role that clients connect to hosts the hub.
if (app.Configuration.GetValue("SignalR:HostHub", true))
{
    app.MapHub<NotificationHub>(HubPath).RequireCors(AppCorsPolicy);
}

await app.RunAsync(app.Configuration["App:Url"] ?? "http://0.0.0.0:8000");

internal sealed record DbInfo(string Database, string ConnectedAs);

internal sealed record DbColumn(string Name, string Type, string Nullable);

// Exposes the implicit Program class to WebApplicationFactory<Program> in integration tests.
public partial class Program { }
