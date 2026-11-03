# Micro-mobility API (.NET)

ASP.NET Core 9 API for the Expo app: auth, vehicles, stations, rides, reservations, wallet,
support, and one aggregate endpoint per screen. PostgreSQL on [Neon](https://neon.tech) through
EF Core; Hangfire for background jobs; SignalR for realtime events.

## Layout

| Path | Role |
| --- | --- |
| `MicroMobility/` | The API. `Program.cs` is the whole composition root. |
| `MicroMobility/Controllers/` | Thin controllers: bind, call one service, return a DTO. |
| `MicroMobility/Services/<Name>/` | Business logic, one folder per service (interface + implementation). |
| `MicroMobility/Data/` | `AppDbContext` (all mapping), migrations, the baseline-aware migrator. |
| `MicroMobility/Models/` | EF entities and enums (mirror the Postgres enum types). |
| `MicroMobility/DTOs/` | Request/response records — the wire contract. |
| `MicroMobility/Middleware/` | `GlobalExceptionHandler`: exceptions → RFC 7807 ProblemDetails. |
| `MicroMobility.Testing/` | Unit tests (pure rules, auth compatibility, config). |
| `MicroMobility.Testing.Integration/` | The real app against a real Postgres 17 container. |
| `legacy-sql/` | The old hand-run SQL scripts, kept for history only. |

## Run it

Prerequisites: .NET 9 SDK. Docker only for the integration tests.

1. Create `MicroMobility/appsettings.Development.json` (gitignored) from
   `appsettings.Development.example.json`. A Neon connection URI (`postgresql://…`) can be pasted
   as-is. `Jwt:Secret` must be at least 32 bytes — reuse the old `JWT_SECRET` and existing app
   sessions stay valid.
2. From the repo root: `npm run backend` (or `dotnet run --project backend/MicroMobility`).

The API listens on `http://0.0.0.0:8000` (`App:Url`). In Development:

- Swagger UI: <http://localhost:8000/swagger>
- Hangfire dashboard: <http://localhost:8000/hangfire>
- Which database you are connected to: <http://localhost:8000/health/db>

### What the first start does to the database

With the defaults (`Database:MigrateOnStartup=true`, `Hangfire:Enabled=true`) the first start:

- creates `__EFMigrationsHistory` and records `InitialSchema` as already applied — the existing
  tables are adopted, not recreated, and no data is touched;
- creates a `hangfire` schema for the job store.

Hangfire polls the database every 15 seconds while the API runs, which keeps a Neon compute awake
(it can still scale to zero once the API stops). Set `Hangfire:Enabled=false` to run without it —
reads then expire lapsed reservations inline on every request.

## Configuration

Order: `appsettings.json` → `appsettings.{Environment}.json` → environment variables → command
line (last wins). Override any key with `__` as the separator, e.g.
`ConnectionStrings__DefaultConnection`, `Jwt__Secret`, `Hangfire__Dashboard__Password`.

| Key | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | Neon URI or Npgsql keyword string. |
| `Jwt:Secret`, `Jwt:ExpireDays` | HS256 signing secret (≥ 32 bytes), token lifetime. |
| `Cors:AllowedOrigins` | Browser origins. Required outside Development (startup fails without it). |
| `Database:MigrateOnStartup` | Apply migrations at boot. Turn off with several replicas and run `--migrate-only` as a release step. |
| `Hangfire:Enabled` / `Hangfire:Server:Enabled` | Job storage on/off; whether this process runs jobs (web vs worker role). |
| `Hangfire:Dashboard:Username` / `Password` | HTTP Basic for `/hangfire` outside Development. Unset = dashboard refuses everyone. |
| `SignalR:HostHub` | Whether this process serves `/hubs/notifications`. |
| `RateLimiting:GlobalPermitLimit` / `AuthPermitLimit` | Requests per minute (per user, else per IP) / register+login per IP. |
| `Reservations:*TtlMinutes` | Default and allowed range for reservation hold times. |

## Logs

Logs go to the console and to rolling daily files in `MicroMobility/logs/`
(`micromobility-YYYYMMDD.log`, kept 14 days, gitignored). Each line in the file carries the request
id in brackets:

```
2026-11-03 16:16:57.598 +02:00 [INF] [0HNPPMKF632SL] Serilog.AspNetCore.RequestLoggingMiddleware: HTTP GET /rides/me responded 401 in 15 ms
```

- **One line per request** (method, path, status, duration). Health checks, the realtime hub and
  the Hangfire dashboard are left out, and query strings, headers and bodies are never logged.
- **Finding one request:** every response has an `X-Request-Id` header (500 bodies also carry it as
  `trace_id`). Search the log file for it to get every line that request produced.
- **Startup failures** (port already in use, bad connection string) are logged with a plain hint.
- **Levels** live in the `Serilog` section of appsettings. To log every SQL statement, set
  `Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore.Database.Command` to `Information`.
- **Files** are configured under `LogFiles` (`Enabled`, `Path`, `RetainedDays`).

## Contract notes for clients

- JSON is snake_case, enums are snake_case strings (`"in_use"`), timestamps are UTC with a `Z`.
- Errors are ProblemDetails: `{ status, title, detail, instance, code? }`. `detail` is a sentence
  safe to show; `code` (e.g. `ActiveRideExists`, `VehicleReservedByAnotherUser`, `EmailTaken`) is
  what to branch on.
- Realtime: connect to `/hubs/notifications` with `?access_token=…`. Events: `RideStarted`,
  `RideEnded`, `ReservationCreated`, `ReservationCancelled`, `ReservationExpired` — each sent only
  to the user it concerns.

## Migrations

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Name> --project MicroMobility --output-dir Data/Migrations
dotnet run --project MicroMobility -- --migrate-only     # apply and exit
```

## Tests

```bash
cd backend
dotnet test                        # unit + integration (integration needs Docker running)
dotnet test MicroMobility.Testing  # unit only
```

The integration suite boots the real app against a throwaway Postgres container built by the
same migrations, and refuses to run if the app is not connected to that container.

## Docker

`Dockerfile` builds one image that can run as a web role, a worker role, or both (see its header).
