# Exhibition Visitor-Scanning & Management Platform

A project that helps exhibitors in an exhibition easily get the details related to the visitors by just scanning their QRCode. the QRCodes are generated automatically in an admin pannel and it can easily be used for any company as the branding logo and theme (automatically according to the logo) is changable via admin pannel.

This project is ~99% vibe-coded (built by prompting an AI coding agent from a detailed spec, see [prompt.md](prompt.md), rather than hand-written line by line). The repo/package name **bye-event** comes from the project it started as a rewrite/successor of, a repository named **Hi-Event**.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Testing the App](#testing-the-app)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Features

**Exhibitor PWA** (mobile-first, installable, offline-first)
- Camera QR scanning with an iOS-safe fallback decoder (native `BarcodeDetector` isn't reliable on Safari/WebKit, so a JS/WASM decoder is always kept live).
- Manual 6-digit short-code lookup as a fallback for a damaged or unscannable badge.
- Scan-first architecture: every scan is written to an on-device outbox (IndexedDB) immediately, even before login or with no network at all.
- Automatic background sync once the exhibitor is authenticated and online, with idempotent server-side upserts so retries/duplicates never double-count.
- On login, the entire pre-login local outbox flushes to the server in one go — nothing scanned before signing in is lost.
- Cached visitor lookups (IndexedDB) so previously scanned visitors open instantly, online or off.
- Personal "scanned visitors" list with search, view, and delete (with undo), plus CSV/PDF export of your own leads.
- Signup/login, profile page, and a live sync-status indicator ("saved offline" / "syncing…" / "synced").

**Admin Panel**
- Visitor management: manual add, full CRUD, and bulk import from CSV/XLSX with per-row validation and partial-success import (valid rows commit, invalid rows are reported for correction).
- Guest badge generation: bulk-create any number of blank "guest" visitor rows with QR codes and short codes pre-assigned, details filled in later.
- Automatic QR token + 6-digit short code generation on every visitor-creating path — never a manual step.
- Print-ready PDF badge export (`@react-pdf/renderer`) with separate templates for invited vs. guest visitors, laid out multiple-per-page with cut guides, including full Persian/Farsi typography support.
- Event branding: upload a logo and the app automatically extracts a brand color palette from it (`node-vibrant`), which both apps then apply live via CSS custom properties — no redeploy needed to reskin the app for a new customer/event. Colors are also manually overridable.
- Exhibitor account management (create, deactivate, instantly revoke sessions).
- Multi-admin support with independent accounts.
- Dashboard with summary stats, an exhibitor leaderboard by scan count, and a searchable visitors table (Recharts + TanStack Table).
- CSV/XLSX/JSON data export for visitors, exhibitors, and visits.

**Platform-wide**
- Two fully isolated auth realms (`admins` vs `exhibitors`) — separate tables, session secrets, cookies, and TTLs.
- Argon2id password hashing everywhere; JWT session cookies (HttpOnly, Secure, SameSite=Lax).
- Every Server Action/Route Handler re-checks auth itself, independent of the `proxy.ts` route guard.
- Atomic Postgres-backed rate limiting on auth and the public visitor-lookup endpoint.
- Self-hostable via Docker Compose, with Caddy handling TLS/CSP/security headers in production.

---

## Architecture

A Turborepo monorepo with two Next.js 16 (App Router) apps sharing one PostgreSQL database through Drizzle ORM.

```
apps/
  exhibitor/    Mobile-first PWA for exhibitors — badge scanning, offline outbox, scanned leads
  admin/        Admin dashboard — visitors, exhibitors, badges, branding, imports/exports
packages/
  db/           Drizzle schema, queries, migrations, atomic rate limiting
  shared/       Zod schemas, Argon2id password hashing, JWT session handling
deploy/
  Caddyfile     Production reverse proxy: TLS, CSP, security headers
docs/           Deployment and security runbooks (see Documentation below)
```

Key points:

- **App Router only** — no `pages/`, no `getServerSideProps`. Route guarding lives in `proxy.ts`, but it's a UX redirect layer; every Server Action and Route Handler re-checks auth independently.
- **Isolated auth realms** — `admins` and `exhibitors` are separate tables with separate session secrets, cookies, and TTLs.
- **Argon2id** for all password hashing.
- **UUIDv7** primary keys; visitor QR tokens are separate, high-entropy identifiers decoupled from row IDs.
- **Offline-first** — the exhibitor PWA writes scans to IndexedDB immediately and syncs idempotently when online.

## Prerequisites

- Node.js `>=22`
- pnpm `11.18.0` (`corepack enable`)
- Docker & Docker Compose (for local Postgres)

## Getting Started

```bash
git clone <repository-url>
cd bye2
pnpm install
```

Create a `.env` at the repo root (see `.env.development.example`), then copy it into each app:

```bash
cp .env.development.example .env
cp .env apps/admin/.env
cp .env apps/exhibitor/.env
```

Start Postgres and run migrations:

```bash
docker compose -f compose.dev.yml up -d postgres
pnpm db:migrate
```

Seed an admin and a sample exhibitor account:

```bash
ADMIN_NAME="System Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="Password123!" pnpm --filter @repo/db seed

EXHIBITOR_FIRST_NAME="Jane" EXHIBITOR_LAST_NAME="Doe" EXHIBITOR_USERNAME="janedoe" \
  EXHIBITOR_PHONE="09120000000" EXHIBITOR_PASSWORD="Password123!" pnpm --filter @repo/db create-exhibitor
```

Run both apps:

```bash
pnpm dev
```

- Exhibitor PWA: [http://localhost:3000](http://localhost:3000)
- Admin Portal: [http://localhost:3001](http://localhost:3001)

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps in development mode |
| `pnpm build` | Build production bundles |
| `pnpm start` | Run production bundles |
| `pnpm lint` | Lint with Biome |
| `pnpm typecheck` | Type-check the whole monorepo |
| `pnpm test` | Run all Vitest suites |
| `pnpm format` | Format with Biome |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Testing the App

- **Camera QR scanning on a phone** requires HTTPS on the LAN — see [docs/mobile-testing.md](docs/mobile-testing.md) for setting up a trusted local certificate and running `pnpm --filter @repo/exhibitor dev:mobile`.
- **Offline sync**: open `/scan`, throttle the network to "Offline" in DevTools, save a scan, confirm it lands in IndexedDB's `visitOutbox`, then go back online and watch it sync via `/api/visits/sync`.

## Deployment

Production runs both apps as standalone Next.js containers behind Caddy (automatic TLS, CSP, security headers):

```bash
docker compose -f compose.production.yml --env-file .env.production run --rm migrate
docker compose -f compose.production.yml --env-file .env.production up -d
```

See [.env.production.example](.env.production.example) for required variables.

## Documentation

- [Production Deployment & Operational Runbook](docs/production-deployment.md)
- [Production Security Checklist](docs/production-security-checklist.md)
- [Production Readiness Handoff](docs/PRODUCTION-READINESS-HANDOFF.md)
- [Mobile Testing Guide](docs/mobile-testing.md)
