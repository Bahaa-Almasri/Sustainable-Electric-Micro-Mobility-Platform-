# Sustainable Electric Micro-Mobility Platform

A cross-platform client plus API for discovering and using shared electric micro-mobility (scooters, e-bikes, and similar vehicles). The **Expo (React Native)** app targets iOS, Android, and web with tabs for wallet, map, reservations, account, and support. The **FastAPI** backend provides authentication, vehicles, rides, wallet, reservations, and support endpoints backed by **PostgreSQL** (for example [Neon](https://neon.tech)).

## Repository layout

| Path | Role |
|------|------|
| `electric-micro-mobility/` | Expo Router app (Expo SDK 54, React 19) |
| `backend/` | FastAPI service (`uvicorn`), `asyncpg`, JWT auth |

## Prerequisites

- **Node.js** 20+ (LTS recommended) and npm  
- **Python** 3.11+ for the API  
- A **PostgreSQL** database URL (`postgresql://...`) for the backend  
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

The client needs a reachable base URL for the FastAPI server. Configure one of:

- Environment: create `electric-micro-mobility/.env` with  
  `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`  
  (physical Android device: use your machine’s LAN IP; **Android emulator**: often `http://10.0.2.2:8000`)
- Or edit `electric-micro-mobility/constants/api-config.ts` / `app.config.js` as noted in the sign-in screen helper text

Restart Expo after changing env vars.

## Start the backend API

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell):** `.venv\Scripts\Activate.ps1`  
**macOS / Linux:** `source .venv/bin/activate`

```bash
pip install -r requirements.txt
copy .env.example .env   # Windows — on Unix use: cp .env.example .env
```

Edit `backend/.env`: set `DATABASE_URL` to a real `postgresql://...` connection string (see comments in `.env.example`), `JWT_SECRET`, and `CORS_ORIGINS` if your Expo web dev server uses another origin. Apply any SQL files under `backend/migrations/` to your database as needed for your schema.

From the **repository root**:

```bash
npm run backend
```

Or manually:

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health).

## Linting (app)

From the repo root:

```bash
npm run lint
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)  
- [Expo Router](https://docs.expo.dev/router/introduction/)  
- [FastAPI](https://fastapi.tiangolo.com/)
