# Centav0

A personal finance tracker for Android, built because I kept losing track of my money — how much I have, how much is left after I pay this and that, and where it all actually goes. So I made the app I wanted: a private, no-frills ledger tailored to how I think about my own money.

It's offline-first and stored entirely on the device — no account, no cloud, no sign-up. Just open it and start logging.

> **Status:** v1.0.0 — [download the APK](https://github.com/StanleighMorales/Centav0/releases/latest) and sideload it on Android.

## Why

I never had a clear picture of my finances. Questions like *"if I pay rent and this bill, how much is left?"* or *"which account is this coming from?"* were always guesswork. Centav0 answers them at a glance — built around my own habits and preferences first, in case it's useful to anyone else too.

## Features

- **Accounts** — Cash, Bank, and e-wallets (GCash, etc.), each with its own balance; total shows on the dashboard
- **Transactions** — log income and expenses, attach a receipt photo, add notes
- **Categories** — label spending (Food, Transport, Bills…); create them inline while adding a transaction
- **Budgets** — set a monthly/weekly limit per category; the bar fills gold → amber → red as you near the cap
- **Debts** — track what you owe, log payments, see open / overdue / paid at a glance
- **Dashboard** — total balance, income vs. expense for the period, and recent activity, with a day/week/month/year selector
- **Reports** — income, expense, net, and a category breakdown for any range
- **First-install tutorial** — walks through the core flows; replayable any time from More ▸ Help
- **Offline & private** — all data lives on-device in SQLite

## Tech stack

- [Expo](https://expo.dev) (SDK 54) + React Native 0.81 + TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local storage
- Repository pattern (`src/repositories/`) — data access is behind interfaces, so the SQLite backend can later be swapped for a remote API without touching the screens

## Project structure

```
app/                  screens & routes (Expo Router)
  (tabs)/             dashboard, transactions, debts, more
  onboarding/         welcome, tutorial, first-account setup
src/
  components/         shared UI + feature components
  repositories/       data access (interfaces + SQLite implementations)
  db/                 schema & migrations
  domain/             types
  theme/              design tokens (colors, type, spacing…)
reference/design.md   the design system source of truth
```

## Getting started

```bash
npm install
npx expo start
```

Because the app uses native modules (SQLite, gesture-handler, image-picker), it runs in a development build or a built APK — not Expo Go.

## Building an APK

Builds use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
eas build -p android --profile preview
```

The `preview` profile (see `eas.json`) outputs a directly-installable `.apk`.

## Roadmap

- Optional cloud sync / multi-device via an ASP.NET Core Web API (EF Core) — the repository layer is already structured for this
- Light theme
- iOS build

## License

Personal project — not currently licensed for redistribution.
