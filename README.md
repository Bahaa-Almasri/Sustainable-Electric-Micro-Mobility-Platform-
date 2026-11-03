# Sustainable Electric Micro-Mobility Platform

A cross-platform client plus API for discovering and using shared electric micro-mobility (scooters, e-bikes, and similar vehicles). The **Expo (React Native)** app targets iOS, Android, and web with tabs for wallet, map, reservations, account, and support. The **ASP.NET Core (.NET 9)** backend provides authentication, vehicles, rides, wallet, reservations, and support endpoints backed by **PostgreSQL** on [Neon](https://neon.tech), with EF Core, Hangfire background jobs and SignalR realtime events.

## Repository layout

| Path | Role |
|------|------|
| `electric-micro-mobility/` | Expo Router app (Expo SDK 58, React 19) |
| `backend/` | ASP.NET Core 9 API, EF Core + Npgsql, Hangfire, SignalR, JWT auth — see [backend/README.md](backend/README.md) |

## Prerequisites

- **Node.js** 20+ (LTS recommended) and npm  
- **.NET 9 SDK** for the API (Docker as well, to run its integration tests)  
- A **PostgreSQL** connection string (a Neon `postgresql://...` URI works as-is)  
- For device testing: [Expo Go](https://expo.dev/go), or iOS Simulator / Android emulator as in [Expo’s environment docs](https://docs.expo.dev/get-started/set-up-your-environment/)

## Start the mobile / web app

From the **repository root** (recommended — scripts forward into the Expo app):

```bash
cd electric-micro-mobility
npm install
cd ..
npm start
```

This runs `expo start`. You can also work only inside the app folder:

```bash
cd electric-micro-mobility
npm install
npm start
```

Useful variants:

- `npm run web` — open in the browser  
- `npm run android` / `npm run ios` — start with a specific platform  

At the Metro prompt, press `w` for web or scan the QR code with Expo Go.

**Do not use** `npx run start` — that installs an unrelated `run` tool and makes Node look for a file named `start`. Use **`npm start`** or, from `electric-micro-mobility/`, **`npx expo start`**.

### Point the app at your API

The client needs a reachable base URL for the API server. Configure one of:

- Environment: create `electric-micro-mobility/.env` with  
  `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`  
  (physical Android device: use your machine’s LAN IP; **Android emulator**: often `http://10.0.2.2:8000`)
- Or edit `electric-micro-mobility/constants/api-config.ts` / `app.config.js` as noted in the sign-in screen helper text

Restart Expo after changing env vars.

## Start the backend API

Copy `backend/MicroMobility/appsettings.Development.example.json` to `appsettings.Development.json` (gitignored) in the same folder and fill in:

- `ConnectionStrings:DefaultConnection` — your Neon connection URI, pasted as-is
- `Jwt:Secret` — at least 32 characters (keep the old `JWT_SECRET` and existing app sessions stay signed in)
- `Cors:AllowedOrigins` — only needed outside Development; in Development any localhost or LAN origin is allowed

From the **repository root**:

```bash
npm run backend        # dotnet watch: restarts on code changes
npm run backend:test   # unit + integration tests (integration needs Docker)
```

Or manually: `dotnet run --project backend/MicroMobility`.

The API listens on port 8000. Check health at [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health); in Development, Swagger UI is at `/swagger` and the Hangfire job dashboard at `/hangfire`. The schema is managed by EF Core migrations, which run on startup. See [backend/README.md](backend/README.md) for configuration, what the first start creates in the database, and deployment.

## Linting (app)

From the repo root:

```bash
npm run lint
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)  
- [Expo Router](https://docs.expo.dev/router/introduction/)  
- [ASP.NET Core](https://learn.microsoft.com/aspnet/core/)  
- [EF Core + Npgsql](https://www.npgsql.org/efcore/)  
- [Hangfire](https://docs.hangfire.io/)
