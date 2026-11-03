# Roadmap

Working plan for the next 3 months. Months 1 and 2 are about making the app itself better — fixing rough edges, filling in missing functionality, improving usability. Month 3 is about making it production-real: real payments, logging/monitoring, and the operational stuff that matters once real people are using it. Check items off as they land; re-prioritize freely — this is a living doc, not a contract.

Last updated: 2026-09-27

## Current state (for context)

- **Backend**: ASP.NET Core 9 + EF Core + PostgreSQL (Neon), Hangfire jobs, SignalR hub. JWT auth, vehicles, stations, rides, reservations, wallet, support controllers. Ported from FastAPI on 2026-11-03.
- **Frontend**: Expo Router (SDK 54, React 19) app with tabs for map, wallet, reservations, account, support. OSM/Leaflet map, QR scan-to-ride, account settings/preferences, dark mode.
- **Known rough spots**: wallet purchases are recorded as `completed` without a real payment gateway; vehicle position/battery only change on ride start/end (no live telemetry); support tickets can be created and listed but not replied to; no admin tooling; no automated tests or CI; no crash/error monitoring.

Month 3 is where the "known rough spots" above get addressed. Months 1–2 are about everything else: making the existing features work better and adding the functionality that's still missing.

---

## Month 1 — Fix and complete core functionality

Goal: every screen that exists today does its job correctly, with no dead ends or confusing states.

- [ ] **Audit each tab for broken/incomplete flows**: go through map, wallet, reservations, account, support end-to-end and list what's half-done, buggy, or missing (this becomes the punch list for the rest of the month).
- [ ] **Reservation lifecycle fixes**: confirm create/cancel/expire all behave correctly and are reflected instantly in the UI; fix any stale-state issues after a reservation converts to a ride.
- [ ] **Ride flow edge cases**: starting a ride on a vehicle that's already reserved/in-use, ending a ride with no connectivity, re-opening the app mid-ride (active ride should resume correctly, not just on the bottom card).
- [ ] **Map/station usability**: verify filters (`vehicle-filters-panel`, `map-stations-filter-sheet`) actually narrow results correctly, station details panel shows accurate live availability, and empty/no-results states are handled instead of a blank map.
- [ ] **Support tab**: tickets can be created and listed — add ticket detail view and a way to see status changes, even without a full reply system yet (that's month 2/3).
- [ ] **Form validation & error messages**: sign-in/sign-up, ticket creation, reservation forms — replace generic/silent failures with clear, specific error messages.
- [ ] **Loading & empty states**: every list/screen that fetches data (vehicles, reservations, payments, tickets) should have a real loading state and a real "nothing here yet" state, not a flash of blank content.

## Month 2 — New functionality and usability improvements

Goal: make the app noticeably nicer and more capable to actually use, not just correct.

- [ ] **Ride history**: a real, browsable list of past rides with cost, duration, and route summary (foundation for the "route replay" idea below, but start simple — a list is enough).
- [ ] **Favorites / recently used vehicles or stations**: quick access from the map or a dedicated section, so returning users don't re-search every time.
- [ ] **Search on map/stations**: text search or "near me" sorting instead of only visual panning/filtering.
- [ ] **Account & preferences polish**: review `account.tsx` (currently the largest screen in the app) for redundant or confusing settings now that some were trimmed recently; make sure every toggle/preference actually does something.
- [ ] **Ratings/feedback after a ride**: quick thumbs-up/down or star rating on the ride-end receipt modal — cheap to add, useful signal later.
- [ ] **Accessibility pass**: screen reader labels, tap target sizes, color contrast in both light and dark mode (dark mode was just fixed — good time to sweep the rest).
- [ ] **Performance/responsiveness**: check map re-render behavior and list rendering (reservations, wallet history) with larger datasets; add pagination/virtualization where lists could grow unbounded.
- [ ] **Cross-platform pass**: spot-check web vs. native behavior (there are already `.web.tsx` variants for map — verify parity elsewhere too, e.g. camera-based QR scan on web).

## Month 3 — Make it real

Goal: replace the parts that are currently mocked/simplified with production-shaped behavior, and add the operational visibility needed to run this for real users.

- [ ] **Real payment gateway**: integrate Stripe (or a regional equivalent) for wallet top-ups/package purchases instead of writing `completed` rows directly. Handle failed payments, refunds, and webhooks.
- [ ] **Logging & error monitoring**: structured logging + request IDs on the backend, Sentry (or similar) on both backend and app so failures in the field are visible instead of silent.
- [ ] **Automated tests + CI**: backend xUnit suites exist (unit + Testcontainers integration, `npm run backend:test`) — still to do: Jest/RNTL for frontend `lib/` helpers and key components, GitHub Actions running both plus lint/typecheck on every push.
- [ ] **Live vehicle telemetry**: background job or simulator that updates `vehicle_current_state` (battery drain, GPS drift) so the map reflects something closer to reality.
- [ ] **Support ticket workflow completion**: replies/status transitions and a way for a human to actually respond, building on the ticket detail view from month 1.
- [ ] **Push notifications**: ride started/ended, reservation about to expire, low wallet balance, support ticket replies.
- [ ] **Admin visibility**: at minimum, a way to view stations/vehicles/rides/tickets without querying the DB directly — doesn't need to be a full dashboard yet.
- [ ] **Secrets hygiene & migration tooling**: confirm `.env` files are fully gitignored with `.env.example` kept current; migrations moved from raw numbered `.sql` files to EF Core (baseline `InitialSchema`, 2026-11-03).

---

## Parking lot (not scheduled yet)

Ideas worth remembering but not committed to a specific month:

- Loyalty/referral program.
- In-app support chat instead of ticket-only.
- Vehicle maintenance scheduling for ops staff.
- Route history / trip replay on the map (builds on Month 2 ride history).
- Analytics (ride counts, revenue, utilization per station/vehicle type) — worth revisiting once real payments (Month 3) are in place.
- Beta rollout via TestFlight/Play internal testing track.

---

## How to use this file

- Update the checkboxes as work lands; leave a short note (date + what changed) in a PR description rather than editing this file's history away.
- When priorities shift, move items between months rather than deleting them — demote to the parking lot if something's no longer relevant.
- Revisit this roadmap at the start of each month to re-rank based on what actually happened the month before.
