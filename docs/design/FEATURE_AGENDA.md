# EcoMobility: Feature Agenda

These are functions that appear in the app or in the [final design](FINAL_DESIGN.md) but don't work yet.

**The designs for these stay as they are.** This list is so the team builds them later and nothing gets forgotten.

Based on a search of the code on branch `feat/firebase-auth-and-ux`. The database's original setup isn't in the repo, so check anything marked "missing" against the live database.

| Priority | Group | Items |
|---|---|---|
| 1 | [Money and wrong numbers](#1-money-and-wrong-numbers) | 5 |
| 2 | [Account and sign-in](#2-account-and-sign-in) | 7 |
| 3 | [History and offers](#3-history-and-offers) | 4 |
| 4 | [Settings that have no effect](#4-settings-that-have-no-effect) | 5 |
| 5 | [Information pages](#5-information-pages) | 6 |
| 6 | [Needed by the new design](#6-needed-by-the-new-design) | 6 |

---

## 1. Money and wrong numbers

These come first because riders could be charged wrongly, or see wrong figures.

- [ ] **Charge riders for rides.** The cost is calculated when a ride ends, but no payment is taken or recorded. `backend/app/routers/rides.py`
- [ ] **Connect ride credits to rides.** Packages sell ride credits, but nothing reduces `rides_remaining` when a ride ends. The team must first choose minute bundles, ride passes or a money balance. `backend/app/routers/wallet.py`, `backend/app/services/pricing.py`
- [ ] **Take real payment for packages.** Buying a package records the payment as `completed` without charging anything. It needs a payment provider. `backend/app/routers/wallet.py:87`
- [ ] **Add payment method.** The button only shows "Add payment method is not available yet." The app can list saved cards, but riders can't add one. `app/(tabs)/wallet.tsx:245`
- [ ] **Ride distance.** No code calculates or saves `distance_meters`, so these are affected:
  - Account **Distance** and **CO₂ saved**, which probably show 0 today.
  - **"2.1 km ridden"** on Active ride in the new design.
  - Quick fix: save the straight-line distance when a ride ends. This is rough, and a round trip shows almost 0 km.
  - Full fix: add up the rider's location during the ride. The phone already follows it for the map.
  - `backend/app/routers/rides.py`, `app/(tabs)/account.tsx:120`, `lib/geo-distance.ts`

## 2. Account and sign-in

- [ ] **Google, Facebook and X sign-in and sign-up.** The buttons show "Coming soon". `app/sign-in.tsx:73`, `app/sign-up.tsx:107`
- [ ] **Edit profile.** `app/(tabs)/account.tsx:335`
- [ ] **Profile photo.** `app/(tabs)/account.tsx:336`
- [ ] **Change password.** `app/(tabs)/account.tsx:413`
- [ ] **Login and security** (sessions, devices, two-step sign-in). `app/(tabs)/account.tsx:337`
- [ ] **Identity verification** (driver's licence or ID). The "Verified rider" label in the design depends on this. `app/(tabs)/account.tsx:428`
- [ ] **Delete account.** The confirmation appears, but nothing is deleted. Apple requires in-app account deletion for apps that let people create accounts, so finish this before an App Store release. `app/(tabs)/account.tsx:307`

## 3. History and offers

- [ ] **Ride history page**, with export and filters. `app/(tabs)/account.tsx:602`
- [ ] **Billing history.** `app/(tabs)/account.tsx:559`
- [ ] **Transactions.** `app/(tabs)/account.tsx:566`
- [ ] **Promo codes.** `app/(tabs)/account.tsx:573`

## 4. Settings that have no effect

The Theme setting works. These can be changed, but nothing in the app acts on them:

- [ ] **Language.** Arabic can be selected, but the app has no translations and no right-to-left layout.
- [ ] **Accessibility** (larger touch targets and contrast).
- [ ] **Sounds.**
- [ ] **Vibration.** The tab bar always vibrates, whatever this is set to.
- [ ] **Notifications.** The 7 toggles aren't saved, so they reset when the screen reloads. The app has no notification package installed, so nothing can be sent yet. This covers push, ride reminders, reservation expiry, promotions, email, SMS and system announcements. `app/(tabs)/account.tsx:66`

## 5. Information pages

All of these show a "future update" message in `app/(tabs)/account.tsx`. Privacy and Terms should be finished before a public release.

- [ ] Emergency contact
- [ ] Safety tips
- [ ] Privacy
- [ ] Terms and conditions
- [ ] FAQ
- [ ] About EcoMobility

## Backend summary (not touched by the frontend revamp)

- **Ride charging:** ride cost is calculated but no payment is taken or recorded.
- **Ride credits:** `rides_remaining` is never reduced when a ride ends.
- **Package payment:** purchases are marked `completed` with no real charge.
- **Payment methods:** no endpoint exists to add a card.
- **Ride distance:** `distance_meters` is never calculated or saved.
- **Ride history:** no export or filter support exists.
- **Reservations:** responses don't include the vehicle's station or distance.
- **Payments:** records don't say what was bought.
- **Ride start:** rides don't store a start station.
- **Support tickets:** no category field and no agent reply data.
- **Account:** no endpoints for profile edit, photo, password change, sessions or deletion.
- **Identity verification:** no verification flow exists.
- **Promo codes:** no endpoint exists.
- **Notifications:** preferences aren't stored and nothing can be sent.

## 6. Needed by the new design

These are shown in the final design but aren't in the app yet.

- [ ] **Support categories.** Full ticket in [FINAL_DESIGN.md, section 8](FINAL_DESIGN.md#8-ticket-to-add-support-categories).
- [ ] **Cost so far** on Active ride. Calculate from the start fee, per-minute rate and elapsed time.
- [ ] **Start station and time** on Active ride.
- [ ] **Walk time** on the Map. Estimate from distance.
- [ ] **Active and Past tabs** on Reservations. The app shows one list today.
- [ ] **Second sign-up step.** The step indicator shows two steps, but sign-up is one form. Phone verification is one option.
