# Backend architecture — the complete guide

This document explains how the micro-mobility backend is built, why it is built that way, and
where everything lives. It is written so you can read it once, top to bottom, and then explain any
part of the system to someone else. Section 18 ("Explaining it to others") has ready-made
summaries at three lengths.

> **Quick facts**
> ASP.NET Core 9 (C#) · PostgreSQL on Neon · EF Core + Npgsql · Hangfire (background jobs) ·
> SignalR (realtime) · Serilog (logging) · xUnit + Testcontainers (tests) · port 8000 ·
> JSON in snake_case · JWT (HS256) authentication.

---

## Contents

1. [The big picture](#1-the-big-picture)
2. [Technology stack and why each piece is there](#2-technology-stack-and-why-each-piece-is-there)
3. [Folder layout](#3-folder-layout)
4. [The layering rule](#4-the-layering-rule)
5. [Life of a request](#5-life-of-a-request)
6. [Startup: Program.cs step by step](#6-startup-programcs-step-by-step)
7. [Authentication and identity](#7-authentication-and-identity)
8. [The data layer](#8-the-data-layer)
9. [The domain: rides, reservations, pricing](#9-the-domain-rides-reservations-pricing)
10. [One request per screen (aggregate endpoints)](#10-one-request-per-screen-aggregate-endpoints)
11. [Errors: one contract everywhere](#11-errors-one-contract-everywhere)
12. [Background jobs (Hangfire)](#12-background-jobs-hangfire)
13. [Realtime (SignalR)](#13-realtime-signalr)
14. [Logging](#14-logging)
15. [Security: CORS, rate limiting, secrets](#15-security-cors-rate-limiting-secrets)
16. [Testing](#16-testing)
17. [Configuration and deployment](#17-configuration-and-deployment)
18. [Explaining it to others](#18-explaining-it-to-others)
19. [Design decisions and trade-offs](#19-design-decisions-and-trade-offs)
20. [Known gaps and next steps](#20-known-gaps-and-next-steps)
21. [API reference](#21-api-reference)
22. [Glossary](#22-glossary)

---

## 1. The big picture

```
 ┌────────────────────────────┐
 │  Expo app (iOS/Android/web)│  electric-micro-mobility/
 │  lib/api-client.ts         │
 └─────────────┬──────────────┘
               │  HTTPS/HTTP + JSON (snake_case)
               │  Authorization: Bearer <JWT>
               │  WebSocket / long polling for realtime (SignalR)
               ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  ASP.NET Core 9 API  (backend/MicroMobility, port 8000)      │
 │                                                              │
 │   Middleware pipeline  →  Controllers  →  Services  →  EF    │
 │   (logging, errors,        (thin)          (all the    Core  │
 │    CORS, auth, rate                         rules)           │
 │    limiting)                                                 │
 │                                                              │
 │   Hangfire server  ── runs "expire reservations" every minute│
 │   SignalR hub      ── pushes ride/reservation events to users│
 └──────────────┬───────────────────────────────────────────────┘
                │  PostgreSQL wire protocol (TLS, channel binding)
                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  Neon PostgreSQL                                             │
 │   schema "public"   – the app's tables (users, rides, …)     │
 │   schema "hangfire" – Hangfire's job storage                 │
 │   __EFMigrationsHistory – which EF migrations are applied    │
 └──────────────────────────────────────────────────────────────┘
```

**What the backend does, in one sentence:** it lets a signed-in rider find stations and vehicles,
reserve a vehicle for a few minutes, start and end a ride (and get billed per minute), buy ride
packages, and file support tickets — while keeping vehicle availability correct even when many
people act on the same vehicle at once.

**Three ideas run through the whole design:**

1. **Thin edges, rich middle.** Controllers only translate HTTP to a method call; all business
   rules live in services; the database is reached only through services.
2. **One error contract.** Every failure, from any layer, leaves the API as the same JSON shape
   (RFC 7807 "ProblemDetails") with a human sentence and a machine `code`.
3. **The database is the referee.** Whenever two requests could race for the same vehicle, the
   decision is made by a single conditional SQL statement or a row lock — never by "read, then
   decide in C#, then write".

---

## 2. Technology stack and why each piece is there

| Piece | What it is | Why it is here |
| --- | --- | --- |
| **.NET 9 / ASP.NET Core** | Microsoft's web framework (C#) | Strongly typed, fast, first-class dependency injection, mature tooling. The project follows a house architecture blueprint built on it. |
| **PostgreSQL on Neon** | Serverless Postgres | The existing database, kept as-is ("keep connecting to Neon for now"). |
| **EF Core 9 + Npgsql** | Object-relational mapper + the Postgres driver | Queries in C# (LINQ), typed entities, schema migrations. Npgsql maps Postgres enums natively. |
| **BCrypt.Net-Next** | bcrypt password hashing | Same `$2b$`, cost-12 format as the hashes already stored, so existing accounts keep working. |
| **JwtBearer** (Microsoft) | Validates JWT access tokens | Standard ASP.NET Core authentication for the app's own HS256 tokens. |
| **Hangfire + Hangfire.PostgreSql** | Background job scheduler, stored in Postgres | Runs the reservation-expiry sweep every minute; ready for future jobs (telemetry, notifications). No extra infrastructure — it uses the same database. |
| **SignalR** (built in) | Realtime messaging over WebSockets | Pushes "ride started", "reservation expired", … to the right user instantly. |
| **Serilog** | Structured logging | Console + rolling daily files + one line per request. .NET has no built-in file logger. |
| **Swashbuckle / OpenAPI** | API documentation | Swagger UI at `/swagger` in Development. |
| **xUnit, FluentAssertions, Testcontainers, Respawn** | Testing | Unit tests for pure rules; integration tests boot the real app against a real throwaway Postgres in Docker. |

---

## 3. Folder layout

```
backend/
├── MicroMobility.sln                    the solution (3 projects)
├── Dockerfile / .dockerignore           one image, web and/or worker role
├── README.md                            how to run, configure, test
├── ARCHITECTURE.md                      this document
├── legacy-sql/                          old hand-run SQL scripts (history only, never run)
├── .config/dotnet-tools.json            pins the `dotnet ef` tool version
│
├── MicroMobility/                       THE API
│   ├── Program.cs                       the entire composition root (startup + pipeline)
│   ├── appsettings.json                 committed defaults (no secrets)
│   ├── appsettings.Development.json     your local secrets (gitignored)
│   ├── appsettings.Development.example.json  template for the above
│   ├── Properties/launchSettings.json   `dotnet run` profile (Development)
│   │
│   ├── Controllers/                     HTTP endpoints, thin
│   ├── Services/<Name>/                 business logic, one folder per service
│   ├── DTOs/                            request/response records = the JSON contract
│   ├── Models/                          EF entities + enums (no logic, no attributes)
│   ├── Data/                            AppDbContext, migrations, migrator, Npgsql setup
│   ├── Middleware/                      GlobalExceptionHandler
│   ├── Exceptions/                      ConflictException, AuthenticationFailedException, ErrorCodes
│   ├── Authorization/                   Hangfire dashboard access filter
│   ├── Configuration/                   JSON, CORS, connection string, logging, rate limits
│   ├── Helpers/                         Guard (input validation)
│   ├── Hubs/                            SignalR NotificationHub
│   └── logs/                            log files at runtime (gitignored)
│
├── MicroMobility.Testing/               unit tests (no database)
└── MicroMobility.Testing.Integration/   real app + real Postgres container
```

### What is in each Services folder

| Folder | Contents | Responsibility |
| --- | --- | --- |
| `Auth/` | `JwtOptions`, `TokenService`, `PasswordHasher` | Issue tokens, define how tokens are validated, hash/verify passwords |
| `CurrentUser/` | `ICurrentUser`, `CurrentUser` | "Who is calling?" for services, read from the validated token |
| `UserService/` | `IUserService`, `UserService` | Register, login, profile |
| `FleetService/` | `IVehicleService`, `IStationService`, `FleetService` | Read-only queries: stations, vehicles, live state |
| `Pricing/` | `PricingRules` (pure), `PricingService` | Rates per vehicle type, billing math |
| `RideService/` | `IRideService`, `RideService` | Start/end rides, ride history, active ride |
| `Reservations/` | `ReservationService`, `ReservationExpiry`, freshness seam, `ReservationExpirySweepJob`, `ReservationOptions` | Reserve/cancel, expiry of lapsed holds |
| `WalletService/` | `IWalletService`, `WalletService` | Packages, purchases, payment history |
| `SupportService/` | `ISupportService`, `SupportService` | Support tickets |
| `ScreenService/` | `IScreenService`, `ScreenService`, `SectionLoader` | One-request-per-screen aggregates |
| `Realtime/` | `INotificationNotifier`, `NotificationNotifier` | Best-effort SignalR pushes |

### DTOs folder convention

Folders group DTOs by resource (`DTOs/Rides/RideDtos.cs`, `DTOs/Wallet/WalletDtos.cs`, …) but all
share one namespace, `MicroMobility.DTOs`, so code needs a single `using`. Folders are for humans.

---

## 4. The layering rule

```
Controller ──▶ IService ──▶ AppDbContext (EF Core) ──▶ PostgreSQL
    │              │
    │              ├──▶ other IServices (e.g. RideService uses IPricingService)
    │              ├──▶ ICurrentUser (who is calling)
    │              └──▶ INotificationNotifier (realtime)
    │
    └──▶ DTOs ◀── Models   (services map entities to DTOs; entities never leave the API)
```

Rules that are never broken:

- **Controllers** bind the request, call **one** service method, return the result. No `if`s about
  the domain, no database access, no try/catch. Example — the whole "start ride" endpoint:
  ```csharp
  [HttpPost("start")]
  public async Task<ActionResult<StartRideResponse>> Start(
      [FromBody] StartRideRequest request, CancellationToken cancellationToken)
      => Ok(await _rides.StartAsync(request, cancellationToken));
  ```
- **Services** hold every rule. They never see `HttpContext`; they learn who is calling through
  `ICurrentUser`. They signal problems by **throwing** (see section 11).
- **Entities (Models)** are plain classes with no attributes; all database mapping is in one place,
  `AppDbContext.OnModelCreating`.
- **DTOs** are the wire contract. An entity is never serialized directly — so adding a column can
  never accidentally leak data or change the JSON.
- **Every dependency is an interface**, registered in `Program.cs`. That is what lets tests swap or
  inspect pieces and lets you replace an implementation (e.g. Firebase auth later) without touching
  callers.

### Dependency injection in one paragraph (for explaining to non-.NET people)

`Program.cs` registers "when someone asks for `IRideService`, give them a `RideService`". When a
request arrives, ASP.NET Core builds the controller and automatically passes it the services its
constructor asks for, which in turn receive *their* dependencies (the `AppDbContext`, the pricing
service, …). Most services are **scoped**: one instance per HTTP request, sharing one database
context for that request. A few are **singletons** (one for the whole app): the password hasher,
the token service, the realtime notifier.

---

## 5. Life of a request

Walkthrough of `POST /rides/start` with body `{"vehicle_id": "…", "start_lat": 33.9, "start_lng": 35.5}`:

```
1  Kestrel (the web server) receives the request on port 8000
2  ForwardedHeaders     – if behind a proxy, restore the real client IP and https scheme
3  Request-id header    – arranges for "X-Request-Id: <id>" on the response
4  Serilog request log  – starts a timer; logs one line when the response finishes
5  Exception handler    – wraps everything below; turns exceptions into ProblemDetails
6  Routing              – matches "POST /rides/start" → RidesController.Start
7  CORS                 – for browser callers, checks the Origin header
8  Authentication       – JwtBearer validates the Bearer token → user principal (sub, email)
9  Authorization        – [Authorize] / fallback policy: no valid user → 401 ProblemDetails
10 Rate limiter         – 200 requests/min per user; over → 429 ProblemDetails
11 Model binding        – JSON body → StartRideRequest record (bad JSON → 400 ProblemDetails)
12 Controller           – calls IRideService.StartAsync(request)
13 RideService          – validates input, opens a transaction, applies the rules (section 9),
                          commits, sends a realtime "RideStarted" event
14 Response             – StartRideResponse → JSON {"ok":true,"ride_id":"…","pricing":{…}}
15 Request log line     – "HTTP POST /rides/start responded 200 in 38 ms" (+ request id, user id)
```

If anything in steps 6–14 throws, step 5 catches it and writes the right status code and
ProblemDetails body; step 15 still logs the final status.

---

## 6. Startup: Program.cs step by step

`Program.cs` is the only place the application is wired together. Its order matters.

**Phase A — register services (before `builder.Build()`)**

1. **Logging**: Serilog replaces the default logger (console + files).
2. **MVC + JSON**: controllers; JSON set to snake_case, enums as snake_case strings, UTC dates
   with `Z`; MVC's "return 204 for null" is removed so `/rides/me/active` returns literal `null`;
   malformed bodies get a readable ProblemDetails.
3. **SignalR** with the same JSON settings, plus `SubUserIdProvider` (maps a connection to a user).
4. **Exception handler** (`GlobalExceptionHandler`) and forwarded-headers settings.
5. **CORS** policy (section 15).
6. **Authentication**: `JwtOptions` validated at startup (secret ≥ 32 bytes); JwtBearer configured
   with the validation rules, the `?access_token=` reader for the hub, and a ProblemDetails 401.
7. **Authorization**: a *fallback policy* — every endpoint requires a signed-in user unless marked
   `[AllowAnonymous]`. Forgetting `[Authorize]` can therefore never expose an endpoint.
8. **Rate limiter** (section 15).
9. **Database**: `AppDbContext` with Npgsql (connection string normalized from a Neon URI).
10. **Hangfire** storage and (optionally) server — section 12.
11. **Options**: CORS, reservation TTLs (validated at startup).
12. **Swagger/OpenAPI**.
13. **Application services** (all the `AddScoped`/`AddSingleton` lines), including the choice of
    reservation "freshness" strategy depending on whether Hangfire is on.

**Phase B — migrate**

14. If `Database:MigrateOnStartup` is true (default) or the app was started with `--migrate-only`,
    run `DatabaseMigrator` (section 8). With `--migrate-only` the app then exits — that is the
    deployment "release step".

**Phase C — the middleware pipeline (order = execution order)**

15. `UseForwardedHeaders` → request-id header → `UseSerilogRequestLogging` → `UseExceptionHandler`
    → (Development: OpenAPI + Swagger UI; otherwise HSTS + HTTPS redirect) → `UseRouting` →
    `UseCors` → `UseAuthentication` → `UseAuthorization` → `UseRateLimiter`.

**Phase D — endpoints**

16. Register the recurring Hangfire job (only in a process that runs jobs).
17. `GET /health` (anonymous, never rate limited), `GET /health/db` (Development only),
    `/hangfire` dashboard, all controllers, the SignalR hub at `/hubs/notifications`.
18. `RunAsync` on `App:Url` (default `http://0.0.0.0:8000`).

**Around all of it:** a `try/catch`. A startup failure (port taken, bad connection string, missing
secret) is logged to console and file with a plain-language hint, and the process exits with code 1.

---

## 7. Authentication and identity

### The model

- The API issues its **own** JSON Web Tokens after email + password sign-in. There is no external
  identity provider (the blueprint's Firebase was deliberately not adopted yet — section 19).
- A token is signed with **HS256** using `Jwt:Secret` and contains three claims:
  `sub` (user id, a UUID), `email`, `exp` (expiry; default 7 days).
- Tokens are **stateless**: the server stores no sessions. Any request with a valid, unexpired,
  correctly signed token is authenticated.

### Flows

```
Register  POST /auth/register {email, password, name, phone_number}
          → validate (email format, password 8–500, name ≤150, phone 7–30)
          → email already used (case-insensitive)? 409 EmailTaken
          → bcrypt hash (cost 12, $2b$) → insert users row (status "active")
          → issue token → {access_token, token_type:"bearer", user_id, email}

Login     POST /auth/login {email, password}
          → find user by lower(email) → bcrypt verify
          → wrong email OR wrong password → the same 401 "Invalid email or password"
            (so sign-in cannot be used to discover which emails have accounts)
          → issue token

Any other request
          Authorization: Bearer <token>
          → JwtBearer validates signature (HS256 only), expiry (no clock leeway)
          → ICurrentUser.RequireUserId() gives services the caller's id
```

### Key files

| File | What it does |
| --- | --- |
| `Services/Auth/TokenService.cs` | `Issue()` creates tokens; `CreateValidationParameters()` defines validation rules (shared with JwtBearer so issuing and validating can't drift). |
| `Services/Auth/PasswordHasher.cs` | `Hash()` / `Verify()`; a malformed or missing stored hash returns false rather than crashing. |
| `Services/CurrentUser/CurrentUser.cs` | Reads `sub`/`email` from the authenticated principal. |
| `Program.cs` (JwtBearer section) | `MapInboundClaims = false` keeps claim names as `sub`/`email`; `OnChallenge` writes the 401 ProblemDetails; `OnMessageReceived` reads `?access_token=` only on the hub path. |

### Things worth knowing

- **Existing users and sessions kept working through the migration**: stored bcrypt hashes verify,
  and tokens issued before the switch validate (same algorithm, same claims, same secret). Four
  tests guard this.
- **Changing `Jwt:Secret` signs everyone out** — old tokens no longer validate.
- **Logout is client-side** (the app deletes its token). A stolen token stays valid until `exp`;
  see "Known gaps".
- **Authorization rules are inside services**, not attributes: e.g. ending a ride checks
  `ride.UserId == caller` (403 otherwise), and cancelling someone else's reservation returns 404
  (as if it did not exist, so ids cannot be probed).

---

## 8. The data layer

### The database (Neon) at a glance

17 tables in `public`. The ones the API uses today:

| Table | Purpose |
| --- | --- |
| `users` | Accounts (bcrypt `password_hash`, `name`, `email` unique, `phone_number`, `status`) |
| `stations` | Docking stations: location, `capacity`, `status` |
| `vehicles` | Fleet: `type` (scooter/bike/ebike/car), `availability_status`, `operational_status`, `station_id` |
| `vehicle_current_state` | One row per vehicle: last lat/lng, battery %, lock state |
| `vehicle_pricing` | Live rates per type: `initial_fee`, `price_per_minute` |
| `rides` | Trips: start/end time and position, status, rate snapshot, `duration_minutes`, `total_cost` |
| `reservations` | Holds on a vehicle: `status`, `reserved_at`, `expires_at`, `cancelled_at` |
| `ride_packages`, `user_package_purchases` | Prepaid ride bundles and who bought them |
| `payments`, `payment_methods` | Payment records (per ride) and saved methods |
| `support_tickets` | Tickets: `title`, `description`, `category`, `priority`, `status` |

Mapped but not used yet (ready for future features): `ride_charges`, `ride_events`,
`telemetry_events`, `user_verifications`, `vehicle_issues`.

Statuses and types are **native PostgreSQL enum types** (e.g. `vehicle_availability_status` =
`available | reserved | in_use | unavailable`). A trigger, `set_updated_at`, keeps `updated_at`
current on seven tables.

### How C# maps to it

- **Entities** live in `Models/` (`User`, `Vehicle`, `Ride`, …). Primary keys are `Guid` (UUID)
  because that is what the existing schema uses.
- **All mapping is in `Data/AppDbContext.cs`**: table names, column names (snake_case), constraint
  and index names identical to Neon's, foreign keys and their delete behaviour, check constraints.
  One file shows the whole schema.
- **Enums** (`Models/Enums.cs`) mirror the Postgres enums. `Data/NpgsqlSetup.cs` registers each
  mapping (`MapEnum<VehicleType>("vehicle_type")`); Npgsql translates `InUse` ↔ `'in_use'`.
  The C# values start at **1**, deliberately: EF Core treats a property's default value (0) as
  "not set" and would silently apply the database default instead of a value you chose.
- **Defaults**: for enums and booleans that have a database default, the mapping says
  `ValueGeneratedNever()` so EF always sends the C# value (same "not set" pitfall). Timestamps like
  `created_at` *are* left to the database's `now()`.

### Time handling (the subtle part)

Most timestamp columns are `timestamp without time zone` holding **UTC**. Three things make that safe:

1. A value converter in `AppDbContext` (`UtcWallClock`) makes every `DateTime` UTC-kind in C# and
   strips the kind when writing (Npgsql refuses UTC-kind values for that column type).
2. `Configuration/JsonSetup.cs` always writes dates as ISO-8601 with a trailing `Z`, e.g.
   `"2026-11-03T09:30:05.123456Z"`. Without the `Z`, JavaScript treats the time as local and ride
   durations are off by the phone's time-zone offset.
3. **Rule for writing queries:** capture the time in a variable first —
   `var now = DateTime.UtcNow;` then use `now` in the query. Writing `DateTime.UtcNow` *inside* a
   LINQ expression makes EF translate it to SQL `now()` (type `timestamptz`), which Postgres refuses
   to compare with these columns. This was a real bug caught by the tests.

### Connection strings

`Configuration/PostgresConnectionString.cs` accepts either an Npgsql keyword string
(`Host=…;Username=…`) or the URI Neon shows in its dashboard
(`postgresql://role:password@host/db?sslmode=require&channel_binding=require`) and converts the
latter (decoding URL-encoded passwords). Unknown URI parameters are refused rather than silently
ignored, so a security setting can never be dropped by accident.

### Migrations and the baseline trick

- Schema changes are **EF Core migrations** in `Data/Migrations/`. The first,
  `20261103000000_InitialSchema`, describes the entire existing database (enums in Neon's exact
  order, the trigger function and triggers included).
- **The problem:** Neon already had all the tables (they were built by the hand-run SQL scripts now
  in `legacy-sql/`), but no EF history. Running `InitialSchema` there would fail on the first
  `CREATE TYPE`.
- **The solution — `Data/DatabaseMigrator.cs`:** before migrating, if `InitialSchema` is not in
  `__EFMigrationsHistory` *and* `public.users` already exists, it records `InitialSchema` as
  applied **without running it** (a "baseline"), then runs any later migrations normally. A fresh,
  empty database (tests, a new environment) gets `InitialSchema` executed for real.
- This was verified by building a database from the migration in Docker and diffing it against
  Neon's schema, and by simulating the baseline on a copy.

Adding a migration later:
```bash
cd backend
dotnet tool restore
dotnet ef migrations add AddSomething --project MicroMobility --output-dir Data/Migrations
dotnet run --project MicroMobility -- --migrate-only
```

---

## 9. The domain: rides, reservations, pricing

### Vehicle availability — the state machine

```
              reserve (conditional UPDATE)
  available ─────────────────────────────▶ reserved
     ▲  ▲                                      │
     │  │   cancel / expire                    │ start ride (by the holder)
     │  └──────────────────────────────────────┤
     │                                         ▼
     │            end ride                  in_use
     └─────────────────────────────────────────┘
     (start ride directly from "available" also goes to in_use)
```

`unavailable` (maintenance etc.) is set outside the app; such vehicles can't be reserved or ridden.

### Reserve a vehicle — `ReservationService.CreateAsync`

1. Clamp the requested hold time to 1–60 minutes (default 15) — `ReservationOptions`.
2. Open a transaction; expire any lapsed reservations first (so a lapsed hold never blocks).
3. **Claim with a conditional UPDATE**:
   `UPDATE vehicles SET availability_status='reserved' WHERE vehicle_id=@id AND availability_status='available'`.
   If two people reserve the same vehicle at the same instant, exactly one UPDATE matches a row;
   the other matches zero and gets `409 VehicleUnavailable`.
4. Insert the reservation row (`reserved_at = now`, `expires_at = now + TTL`), commit, notify.

### Cancel — `ReservationService.CancelAsync`

Only the owner's reservation is found (others → 404). If active: set `cancelled`, release the
vehicle back to `available` — both conditional, so a reservation that was converted to a ride or
expired a moment earlier is reported as "Reservation already inactive" instead of corrupting state.

### Start a ride — `RideService.StartAsync` (the most important flow)

All inside one transaction:

1. Expire lapsed reservations.
2. Caller already has a `started` ride? → `409 ActiveRideExists`.
3. **Lock the vehicle row** (`SELECT … FOR UPDATE`). Two riders scanning the same QR code now
   queue behind each other instead of both succeeding.
4. Find an active, unexpired reservation for the vehicle and decide:
   - vehicle `reserved`, no valid reservation → `409 VehicleUnavailable`
   - reserved by someone else → `409 VehicleReservedByAnotherUser`
   - `available` or reserved by the caller → OK
   - anything else (`in_use`, `unavailable`) → `409 VehicleUnavailable`
5. Look up the current rate for the vehicle type and **snapshot** it on the ride
   (`initial_fee`, `price_per_minute`).
6. Insert the ride (`status = started`, `started_at = now`, start position).
7. Conditionally set the vehicle to `in_use`; if that matches no row, everything rolls back.
8. If the caller held a reservation, mark it `converted_to_ride`.
9. Touch `vehicle_current_state.updated_at`, commit, push `RideStarted` to the rider.

### End a ride — `RideService.EndAsync`

1. **Lock the ride row** — a double-tapped "End ride" bills once; the second call sees a completed
   ride and gets `409 RideNotActive`.
2. Not your ride → 403. Not `started`/`paused` → 409.
3. Compute the bill (below), update the ride (`completed`, end time/position, minutes, rates,
   `total_cost`), set the vehicle `available`, commit, push `RideEnded`.

### Pricing — `Services/Pricing/`

- `PricingRules.cs` is **pure** (no database), so every rule is unit-tested:
  - type normalization: lower-case; `ebike` is priced as `bike`
  - **billed minutes** = elapsed time rounded **up**, minimum 1 (61 s → 2 min)
  - **total** = `initial_fee + minutes × price_per_minute`, rounded to 4 decimals
  - code defaults if the `vehicle_pricing` row is missing: scooter 0.50 + 0.20/min,
    bike 0.75 + 0.25/min, car 1.50 + 0.50/min; an unknown type gets the scooter tier
- `PricingService.cs` reads `vehicle_pricing` (database wins), falls back to the defaults, and never
  lets a pricing lookup failure break a ride.
- The rate is re-read **at ride end**, so an admin rate change applies to rides ending afterwards.
- `GET /rides/pricing/catalog` shows each type's rate and its `source`
  (`database` / `default` / `safe_fallback`).

### Reservation expiry

A lapsed reservation must flip to `expired` and free its vehicle. `ReservationExpiry.ExpireDueAsync`
does both in **one atomic SQL statement** (two data-modifying CTEs), returning what it expired so
the users can be notified. It runs:

- **inside every write path** (reserve, start ride, cancel) — decisions are never made on a lapsed hold;
- **every minute** via the Hangfire job when Hangfire is on;
- **on read paths** only when Hangfire is off (tests, minimal deployments). This choice is the
  "freshness seam": `IReservationFreshness` is registered as either `ScheduledReservationFreshness`
  (no-op) or `InlineReservationFreshness` in `Program.cs`.

### Wallet and support

- **Packages** (`GET /wallet/packages`): active ones, cheapest first.
- **Purchase** (`POST /wallet/purchase`): records a `user_package_purchases` row with the package's
  credits. **There is no payment gateway and no payments row** — `payments.ride_id` is NOT NULL in
  the schema, so a package payment can't be represented until that changes.
- **Support tickets**: the app sends `subject`; it is stored in `title` and returned under both
  names. Category defaults to `other`, priority to `medium`.

---

## 10. One request per screen (aggregate endpoints)

Phones on cellular pay heavily for each round trip, so each main screen has one endpoint that
returns everything it needs:

| Endpoint | Screen | Required part | Optional sections |
| --- | --- | --- | --- |
| `GET /map/overview` | Map | — | `active_ride`, `pricing`, then `stations` (no ride) **or** `parking_stations` (riding) |
| `GET /users/me/summary` | Account | `profile` (fails the request if missing) | `rides`, `reservations`, `wallet` |
| `GET /vehicles/{id}/details` | Vehicle | `vehicle` (404 if missing) | `my_reservations` (caller's, this vehicle), `pricing` |

How it works (`Services/ScreenService/ScreenService.cs`):

- Each optional section is loaded through `SectionLoader.TryAsync(name, …)`. If it fails, the
  error is logged, the section comes back **`null`**, and a message is put in `errors[name]` — the
  rest of the screen still renders.
- **`null` means "could not load"; `[]` means "genuinely empty."** The app should keep its last
  good copy of a `null` section.
- Every response includes `server_time` so clients can compute countdowns against the server's
  clock rather than the phone's.
- Sections run **one after another**, not in parallel: they share one `DbContext`, which is not
  thread-safe. One DB round trip per section is still far cheaper than several HTTP requests.

---

## 11. Errors: one contract everywhere

### The shape

Every error response is RFC 7807 ProblemDetails, content type `application/problem+json`:

```json
{
  "status": 409,
  "title": "Conflict",
  "detail": "Vehicle is currently reserved by another user",
  "instance": "/rides/start",
  "code": "VehicleReservedByAnotherUser"
}
```

- `detail` is a sentence safe to show the user. The Expo app's `api-client.ts` already reads it.
- `code` is stable and meant for branching in code; wording may change, codes don't.
- A 500 never reveals internals: `detail` is "Internal server error" plus a `trace_id` that matches
  the log line (section 14).

### How exceptions become responses

Services **throw**; nobody catches except `Middleware/GlobalExceptionHandler.cs`:

| Thrown | Status | Typical source |
| --- | --- | --- |
| `ArgumentException` (from **our** code) | 400 | `Guard` validation, e.g. "vehicle_id is required." |
| `AuthenticationFailedException` | 401 | wrong email/password |
| `UnauthorizedAccessException` | 403 | "Not your ride" |
| `KeyNotFoundException` | 404 | "Vehicle not found" |
| `ConflictException(message, code)` | 409 | state conflicts (vehicle taken, ride already active…) |
| anything else | 500 | bugs, database outages |

**Safety detail:** libraries throw `ArgumentException` too (Npgsql once did, with an internal
message). The handler only treats an `ArgumentException` as a 400 if it was thrown from code in the
`MicroMobility` namespace; anything else becomes an opaque 500. Internal messages can't leak.

Other error sources produce the same shape:

- **Missing/invalid token** → 401 written by JwtBearer's `OnChallenge` (`NotAuthenticated` /
  `InvalidToken`).
- **Malformed JSON / wrong types** → 400 from MVC's model validation, e.g. `vehicle_id: has an invalid value`.
- **Rate limit** → 429 `RateLimited`.

### Error codes (`Exceptions/Exceptions.cs`)

`NotAuthenticated`, `InvalidToken`, `InvalidCredentials`, `ValidationFailed`, `EmailTaken`,
`ActiveRideExists`, `VehicleUnavailable`, `VehicleReservedByAnotherUser`, `RideNotActive`,
`RateLimited`.

---

## 12. Background jobs (Hangfire)

- **Storage:** Hangfire keeps its jobs in the same Neon database, in its own `hangfire` schema
  (created automatically on first start).
- **The job today:** `ReservationExpirySweepJob`, every minute (`Cron.Minutely()`), id
  `reservation-expiry-sweep`. It is idempotent (a second run finds nothing),
  `[DisableConcurrentExecution]` (runs never overlap), and `[AutomaticRetry(Attempts = 0)]`
  (the next minute's run *is* the retry).
- **Jobs are plain classes** resolved from DI — a test simply resolves the job and calls
  `RunAsync()`.
- **Dashboard** at `/hangfire`: open in Development; elsewhere it needs HTTP Basic credentials
  (`Hangfire:Dashboard:Username/Password`) and refuses everyone if they're unset. The credential
  check uses constant-time comparison.
- **Web and worker roles:** `Hangfire:Enabled` turns job *storage* on (needed to schedule jobs);
  `Hangfire:Server:Enabled` decides whether *this process* runs them. One process does both by
  default; in production you can run one container as "web" (serves requests) and another as
  "worker" (runs jobs) from the same image, so heavy jobs never slow requests down.
- **Cost note:** Hangfire polls the database every 15 s while the API runs, which keeps a Neon
  compute awake. It can still scale to zero once the API stops. Set `Hangfire:Enabled=false` to
  avoid it entirely (reads then expire reservations inline).

---

## 13. Realtime (SignalR)

- **Hub:** `/hubs/notifications` (`Hubs/NotificationHub.cs`). It requires a signed-in user and has
  no client-callable methods — the server only pushes.
- **Connecting:** SignalR clients send the token as `?access_token=…` (WebSockets can't carry custom
  headers). The API accepts the query-string token **only** on this path, and the request logger
  never logs query strings.
- **Who receives what:** `SubUserIdProvider` ties each connection to the token's `sub`; the notifier
  sends with `Clients.User(userId)`. A user can only ever receive their own events.
- **Events** (`DTOs/Notifications/NotificationDtos.cs`):

  | Event | Payload | When |
  | --- | --- | --- |
  | `RideStarted` | ride_id, vehicle_id, status | after the start transaction commits |
  | `RideEnded` | ride_id, vehicle_id, status, total_cost | after the end transaction commits |
  | `ReservationCreated` | reservation_id, vehicle_id, status, expires_at | after reserving |
  | `ReservationCancelled` | reservation_id, vehicle_id, status | after cancelling |
  | `ReservationExpired` | reservation_id, vehicle_id, status | whenever a hold lapses |

- **Best-effort:** events are sent **after** the database commit (so nobody is told about something
  that was rolled back) and a delivery failure is logged, never thrown — realtime can't break a ride.
- **Status:** the backend sends these today; the Expo app does not listen to them yet.

---

## 14. Logging

Configured in `Configuration/LoggingSetup.cs` (Serilog).

- **Where:** the console, and rolling daily files in `MicroMobility/logs/micromobility-YYYYMMDD.log`
  (14 days kept, 50 MB per file max, gitignored, readable while the API runs).
- **One line per request:** `HTTP POST /rides/start responded 409 in 42 ms`, with the user id and
  client IP attached. `/health`, `/hubs` and `/hangfire` are excluded (noise). Query strings,
  headers and bodies are **never** logged — tokens and passwords cannot end up in a log file.
- **Request id:** every file line carries `[<request id>]`; every response has the header
  `X-Request-Id: <request id>` (readable by browser JavaScript too); a 500 body contains the same
  value as `trace_id`. To investigate a report: get the id, search the log file, and you see every
  line that request produced, including any stack trace.
- **Startup failures** go to the file with a hint (e.g. "The port … is already in use — is another
  copy of the backend or another server still running on it?").
- **Levels** in `appsettings.json` → `Serilog:MinimumLevel`. To see every SQL statement, set
  `Override:Microsoft.EntityFrameworkCore.Database.Command` to `Information`.
- **Files** under `LogFiles` (`Enabled`, `Path`, `RetainedDays`).

---

## 15. Security: CORS, rate limiting, secrets

### CORS (browser access — only matters for Expo **web**)

- **Development:** any `localhost`/`127.0.0.1` origin on any port, any private-LAN origin
  (10.x, 172.16–31.x, 192.168.x), plus `Cors:AllowedOrigins`.
- **Elsewhere:** only `Cors:AllowedOrigins`. If that list is empty, the app **refuses to start** —
  better than shipping an API with no origin policy.
- Credentials allowed (SignalR needs them), so a wildcard origin is impossible by design.
- Native iOS/Android apps don't use CORS at all.

### Rate limiting

| Policy | Limit | Partitioned by | Applies to |
| --- | --- | --- | --- |
| global | 200 requests / minute | signed-in user, else IP | everything except `/health`, `/hubs`, `/hangfire` |
| `auth` | 10 requests / minute | IP | `/auth/register`, `/auth/login` (slows password guessing) |

Configurable under `RateLimiting`. Exceeding a limit returns 429 ProblemDetails.

### Secrets

- **Never committed:** `appsettings.Development.json` (Neon URL, JWT secret) is gitignored and is
  excluded from the published Docker image.
- **Production:** set secrets as environment variables, e.g. `ConnectionStrings__DefaultConnection`,
  `Jwt__Secret`, `Hangfire__Dashboard__Password` (`__` = nesting).
- **Fail fast:** a missing/short JWT secret, an invalid reservation config, or (outside
  Development) missing CORS origins stops the app at startup instead of failing on a user's request.

### Other protections

- Fallback authorization policy (every endpoint needs a user unless explicitly anonymous).
- Uniform login failure message (no account enumeration).
- Ownership checks in services; other users' reservations look nonexistent.
- Request validation with explicit length limits matching the database columns.
- `/health/db` (which reveals database/user names) exists only in Development.

---

## 16. Testing

```bash
cd backend
dotnet test                         # everything (integration needs Docker running)
dotnet test MicroMobility.Testing   # unit tests only
# or from the repo root:  npm run backend:test
```

### Unit tests — `MicroMobility.Testing` (53 tests, ~2 s, no database)

Pricing rules (billing minutes, totals, type normalization, fallbacks), reservation TTL clamping,
compatibility with existing bcrypt hashes and previously issued tokens, rejection of expired /
wrongly signed / unsigned (`alg: none`) tokens, Neon URI parsing, JSON date and enum format, email
validation, Hangfire dashboard credential check, startup-failure logging.

### Integration tests — `MicroMobility.Testing.Integration` (48 tests, ~10 s)

- **Real everything:** the actual app (via `WebApplicationFactory`) against a real **Postgres 17**
  container started by **Testcontainers**. The schema is built by the same `InitialSchema`
  migration, so the tests also prove the migration produces a working database.
- **Isolation:** **Respawn** empties all tables before each test (not after, so a failed test's data
  can be inspected).
- **Safety:** the fixture forces the container's connection string via an environment variable and
  **refuses to run** if the app is connected anywhere else — tests can never touch Neon.
- **Coverage:** auth and the error contract, CORS, validation messages, fleet queries, the full ride
  lifecycle and billing, double-end, one active ride per user, reservation races and ownership,
  expiry (inline and via the job), wallet, support, all three screen aggregates, SignalR delivery
  (and that other users don't receive events), rate limiting, the Hangfire dashboard and schedule,
  Swagger, request-id headers and the log file contents.

---

## 17. Configuration and deployment

### Configuration sources (later wins)

`appsettings.json` → `appsettings.{Environment}.json` → environment variables → command line.

| Key | Default | Meaning |
| --- | --- | --- |
| `ConnectionStrings:DefaultConnection` | placeholder | Neon URI or keyword string |
| `App:Url` | `http://0.0.0.0:8000` | Listen address |
| `Jwt:Secret` / `Jwt:ExpireDays` | — / 7 | Token signing secret (≥32 bytes) / lifetime |
| `Cors:AllowedOrigins` | `[]` | Browser origins (required outside Development) |
| `Database:MigrateOnStartup` | true | Apply migrations at boot |
| `Reservations:DefaultTtlMinutes` / `Min` / `Max` | 15 / 1 / 60 | Reservation hold times |
| `Hangfire:Enabled` / `Server:Enabled` | true / true | Job storage / run jobs in this process |
| `Hangfire:Server:WorkerCount` / `ShutdownTimeoutSeconds` | 2 / 60 | Job threads / graceful shutdown |
| `Hangfire:Dashboard:Username` / `Password` | empty | Dashboard login outside Development |
| `SignalR:HostHub` | true | Serve `/hubs/notifications` from this process |
| `RateLimiting:GlobalPermitLimit` / `AuthPermitLimit` | 200 / 10 | Per-minute limits |
| `Serilog:MinimumLevel` | Information (Microsoft: Warning) | Log levels |
| `LogFiles:Enabled` / `Path` / `RetainedDays` | true / `logs/micromobility-.log` / 14 | Log files |

**Environments:** `dotnet run` uses Development (`launchSettings.json`): Swagger on, open Hangfire
dashboard, relaxed CORS, `/health/db` available. Any other environment: HSTS + HTTPS redirect,
strict CORS, protected dashboard.

### Running locally

```bash
npm run backend          # from the repo root: dotnet watch (restarts on code changes)
```
Swagger: http://localhost:8000/swagger · Jobs: http://localhost:8000/hangfire ·
Health: http://localhost:8000/health

### Deployment (Docker)

```
1. docker build -t micromobility backend/
2. Release step (once per deploy):   docker run … micromobility --migrate-only
3. Start the app:
   single container:  docker run -e ConnectionStrings__DefaultConnection=… -e Jwt__Secret=… micromobility
   or split roles:    web:    -e Hangfire__Server__Enabled=false -e SignalR__HostHub=true
                      worker: -e Hangfire__Server__Enabled=true  -e SignalR__HostHub=false
```

The image runs as a non-root user, exposes port 8000, and has a health check on `/health`.
With more than one replica, set `Database__MigrateOnStartup=false` and rely on the release step, so
replicas don't race to migrate.

---

## 18. Explaining it to others

### 30 seconds

> "The backend is an ASP.NET Core 9 API in C# on top of our Neon Postgres database. Controllers are
> thin; all rules live in services that use EF Core. Riders sign in with email and password and get
> a JWT. The tricky part — two people grabbing the same scooter — is decided by the database with
> row locks and conditional updates, so it's race-safe. Errors always come back in one JSON format,
> a background job expires reservations every minute, and the server pushes live ride and
> reservation events over SignalR. It's covered by about 100 tests, including integration tests
> against a real Postgres in Docker."

### 2 minutes — the tour

1. **Shape:** Expo app → REST + JSON (snake_case) → ASP.NET Core API → EF Core → Neon Postgres.
2. **Layers:** Controller (HTTP only) → Service (rules) → DbContext (data). DTOs are the contract;
   entities never leave the API.
3. **Auth:** our own HS256 JWTs (`sub`, `email`, `exp`), bcrypt passwords; every endpoint requires a
   user unless explicitly anonymous.
4. **Correctness:** reserving is one conditional UPDATE; starting a ride locks the vehicle row;
   ending locks the ride row — no double bookings, no double billing.
5. **Money:** per-minute pricing with a rate snapshot at start and recomputation at end; minutes
   round up, minimum one.
6. **Errors:** ProblemDetails with a readable `detail` and a stable `code`.
7. **Jobs and realtime:** Hangfire (in the same database) expires holds every minute; SignalR tells
   the right user immediately.
8. **Operations:** request logs with a request id that's also returned to clients; rate limits;
   strict CORS in production; migrations with a baseline that adopted the existing database safely.
9. **Quality:** unit + integration tests (Testcontainers), and every commit builds and passes.

### 10 minutes — follow one ride

Use section 5 (life of a request) with the start-ride flow from section 9, then show the
end-ride locking, the bill math, and finally the `RideEnded` event and the request-log line with its
request id. That single story touches every layer.

### Likely questions and answers

**Why .NET instead of Python?** Strong typing end to end, a single well-defined composition root,
first-class dependency injection and background jobs, and alignment with the team's architecture
blueprint. The HTTP contract was kept identical, so the app didn't change.

**What stops two people from reserving the same scooter?** A single `UPDATE … WHERE availability_status = 'available'`.
Postgres guarantees only one of two simultaneous updates can match; the loser gets a 409.

**What if someone taps "End ride" twice?** The ride row is locked (`FOR UPDATE`); the second request
waits, then sees the ride is completed and gets `409 RideNotActive`. Billing happens once.

**What happens if the realtime push fails?** Nothing breaks: pushes are sent after commit and
failures are only logged. The app catches up on its next refresh.

**How were existing users kept?** Same bcrypt format, same JWT algorithm/claims/secret — old
passwords and even already-issued sessions keep working (tested).

**How did you move an existing database to EF migrations without recreating it?** A baseline: the
first migration describes the existing schema, and on a database that already has it, it's recorded
as applied without being run.

**Where do I look when something fails?** Get the `X-Request-Id` (or `trace_id`) from the response,
search `backend/MicroMobility/logs/` for it.

**How do I add a feature?** See the recipe below.

### Recipe: adding a new endpoint end to end

1. **Model** (if new data): entity in `Models/`, mapping in `AppDbContext.OnModelCreating`, then
   `dotnet ef migrations add …`.
2. **DTOs** in `DTOs/<Area>/`: a request record (nullable fields, validated in the service) and a
   response record.
3. **Service**: add a method to the interface and implementation in `Services/<Name>/`. Validate
   with `Guard`, get the caller via `ICurrentUser`, throw the right exception for each failure,
   use a conditional UPDATE or row lock if two users could race.
4. **Register** it in `Program.cs` if it's a new service.
5. **Controller**: one thin action calling the service.
6. **Tests**: unit tests for pure rules; an integration test for the happy path and each error.
7. **App**: add the call in `electric-micro-mobility/lib/mobility-api.ts` and the type in `types/entities.ts`.

---

## 19. Design decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| **Kept the app's own JWT auth** instead of the blueprint's Firebase | No app changes, no Firebase project, existing users unaffected | No email verification, password reset or social login yet; tokens can't be revoked early |
| **Kept the existing Neon schema** (UUID keys, native Postgres enums) instead of the blueprint's `long` ids and string enums | No data migration, no downtime | Diverges from the blueprint's conventions |
| **snake_case JSON** (blueprint default is camelCase) | The app already speaks snake_case | Different from other blueprint-based projects |
| **Kept the old response shapes**, including aliases (`start_time` = `started_at`, `cost` = `total_cost`, `subject` = `title`) and always-null `model`/`qr_code` | Zero app changes | Some redundancy in payloads |
| **Raw SQL for reservation expiry** (rest is LINQ) | Needs one atomic statement updating two tables | One place where SQL is hand-written |
| **Hangfire in the same database** | No extra infrastructure | Keeps the Neon compute awake while the API runs |
| **Left out** file storage (R2), push notifications (FCM), email (SMTP) | No current feature needs them | Will be added with the features that need them |
| **Sequential (not parallel) section loading** in aggregates | DbContext isn't thread-safe | Slightly slower than parallel queries, still far fewer round trips |
| **Rate snapshot at start, re-priced at end** | Admin rate changes apply to rides ending after them | The price shown at start can differ from the final bill if rates change mid-ride |

### What changed compared with the old Python backend

- Support tickets now save (the old code wrote to a non-existent `subject` column and omitted the
  required `category`).
- Package purchase now works (it always failed before) — but writes no payment row (see section 9).
- You can no longer cancel another user's reservation (the old code didn't check ownership).
- Reservation expiry moved from every request to a 1-minute job (writes still expire inline).
- Errors gained a `code`; the JSON `detail` field the app reads is unchanged.
- `/health/db` is Development-only.
- New: realtime events, request ids, log files, rate limiting, Swagger, automated tests.

---

## 20. Known gaps and next steps

- **Payments:** no payment gateway; package purchases don't create a `payments` row because
  `payments.ride_id` is NOT NULL. Needs a schema change plus a gateway (roadmap month 3).
- **Auth features:** no refresh tokens, password reset, email verification or server-side logout
  (a token stays valid until it expires).
- **Realtime in the app:** the backend emits events; the Expo app doesn't subscribe yet.
- **Telemetry:** vehicle position/battery only change on ride start/end; `telemetry_events` exists
  but is unused.
- **CI:** tests run locally (`npm run backend:test`); no GitHub Actions workflow yet.
- **Admin tooling:** none; the Hangfire dashboard is the only operational UI.
- **Neon cost:** Hangfire polling keeps the compute awake while the API runs.
- **Error monitoring:** logs are local files; no Sentry-style aggregation yet.

---

## 21. API reference

All routes require `Authorization: Bearer <token>` unless marked *anonymous*.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` *(anonymous, auth rate limit)* | Create account, returns token |
| POST | `/auth/login` *(anonymous, auth rate limit)* | Sign in, returns token |
| GET | `/users/me` | Caller's profile |
| GET | `/users/me/summary` | Account screen aggregate |
| GET | `/users/{id}` | Own profile by id (others → 403) |
| GET | `/vehicles/available` | Available vehicles with a position |
| GET | `/vehicles/{id}` | One vehicle with state |
| GET | `/vehicles/{id}/details` | Vehicle screen aggregate |
| GET | `/stations/active` | Active stations + rentable vehicle counts |
| GET | `/stations/parking-available` | Stations with a free slot |
| GET | `/stations/{id}/vehicles` | Rentable vehicles at a station |
| GET | `/map/overview` | Map screen aggregate |
| GET | `/rides/me` | Ride history, newest first |
| GET | `/rides/me/active` | Active ride or `null` |
| GET | `/rides/pricing/catalog` | Rates per vehicle type |
| POST | `/rides/start` | Start a ride `{vehicle_id, start_lat, start_lng}` |
| POST | `/rides/end` | End a ride `{ride_id, end_lat, end_lng}` |
| GET | `/reservations/me` | Caller's reservations |
| POST | `/reservations/me` | Reserve `{vehicle_id, minutes_ttl?}` |
| DELETE | `/reservations/me/{id}` | Cancel own reservation |
| GET | `/wallet/packages` | Packages on sale |
| GET | `/wallet/overview` | Purchases, payment methods, recent payments |
| POST | `/wallet/purchase` | Buy a package `{package_id}` |
| GET | `/support/tickets` | Caller's tickets |
| POST | `/support/tickets` | Create `{subject, description, category?}` |
| GET | `/health` *(anonymous)* | Liveness |
| GET | `/health/db` *(anonymous, Development only)* | Which database the API is connected to |
| — | `/swagger` *(Development)* | Interactive API docs |
| — | `/hangfire` | Job dashboard |
| — | `/hubs/notifications` | SignalR realtime hub |

---

## 22. Glossary

| Term | Meaning |
| --- | --- |
| **ASP.NET Core** | Microsoft's framework for web APIs in C#. |
| **Kestrel** | The web server built into ASP.NET Core. |
| **Middleware / pipeline** | A chain of components every request passes through in order (logging, errors, auth, …). |
| **Controller / action** | A class / method that handles a route. |
| **Dependency injection (DI)** | The framework creates objects and passes them their dependencies, based on registrations in `Program.cs`. |
| **Scoped / singleton** | One instance per request / one for the whole app. |
| **DTO** | Data Transfer Object — a record defining the JSON shape of a request or response. |
| **Entity** | A C# class mapped to a database table. |
| **EF Core** | Entity Framework Core, the ORM: write queries in C# (LINQ), get SQL. |
| **DbContext** | EF's unit of work: a database session with the mapping; one per request. |
| **Migration** | A versioned, code-generated schema change. |
| **Baseline migration** | Recording an initial migration as applied on a database that already has that schema. |
| **Npgsql** | The .NET driver for PostgreSQL. |
| **Conditional UPDATE** | `UPDATE … WHERE <expected state>` — succeeds for exactly one of several racing requests. |
| **Row lock (`FOR UPDATE`)** | Makes other transactions wait for a row until the current one commits. |
| **CTE** | Common Table Expression (`WITH …`); here used to update two tables in one statement. |
| **JWT** | JSON Web Token — a signed token carrying the user id and an expiry. |
| **HS256** | HMAC-SHA256: the token is signed with a shared secret. |
| **bcrypt** | A slow, salted password-hashing algorithm. |
| **ProblemDetails (RFC 7807)** | Standard JSON format for HTTP errors. |
| **CORS** | Browser rule deciding which websites may call the API. |
| **Hangfire** | Background job library; stores jobs in Postgres. |
| **SignalR** | Realtime server→client messaging (WebSockets with fallbacks). |
| **Serilog** | Structured logging library. |
| **Testcontainers** | Starts throwaway Docker containers (here Postgres) for tests. |
| **Respawn** | Quickly empties database tables between tests. |
| **Neon** | Serverless PostgreSQL hosting; compute can scale to zero when idle. |
