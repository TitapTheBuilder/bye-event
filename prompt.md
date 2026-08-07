# Exhibition Visitor-Scanning Platform — Full Build Specification

**Read this entire document before writing any code.** It is the complete brief for a two-application system: an **Exhibitor PWA** (badge scanning) and an **Admin Panel** (event/data management), sharing one PostgreSQL database. Where a decision isn't explicitly specified, use the defaults given here rather than asking — they were chosen deliberately for a 2026 production build. Only stop and ask if something is genuinely contradictory.

You are building this as an **elite, current (2026) full-stack engineer**. Concretely, that means:
- App Router only. No Pages Router.
- No deprecated APIs, no legacy config formats, no abandoned packages (a specific do-not-use list is in §3).
- Security is a first-class requirement, not an afterthought — see §5.
- The offline-first behavior in §6 is the hardest and most important part of this build. Do not simplify it away.

---

## 1. What we're building

An exhibition has **exhibitors** (booth staff) and **visitors** (attendees). Every visitor wears a badge printed with a unique QR code. Exhibitors use a mobile-first web app to scan a visitor's badge, instantly see that visitor's contact info for follow-up, and build a personal list of everyone they've talked to. Every scan is recorded server-side as a **Visit** (which exhibitor scanned which visitor, and when).

Two categories of visitor exist:
- **Invited** — pre-registered by an admin before the event, full contact info known in advance.
- **Guest** — walk-ins. Their QR badges are pre-generated in bulk *before* the event with no name attached yet; a guest's real details get filled in later by an admin.

A separate **Admin Panel** (its own app, full database access) is where event organizers manage all of this: import/add visitors, bulk-generate guest badges, run reports, and export print-ready badges for the whole event.

The product is white-label: it will be reused for other companies' events, so branding (the customer's logo and brand colors) must be configurable per deployment, not hardcoded — except the University of Tehran mark, which is fixed and always shown as the platform's developer credit.

---

## 2. System architecture

**Monorepo**, two Next.js apps, one shared database package. They are separate deployable applications (separate auth, separate sessions, can be deployed to separate URLs/subdomains) but must never define the database schema twice.

```
exhibition-system/
├── apps/
│   ├── exhibitor/              # PWA — booth staff use this
│   └── admin/                  # Internal tool — organizers use this
├── packages/
│   ├── db/                     # Drizzle schema, client, migrations — single source of truth
│   ├── shared/                 # Zod schemas, shared types, constants
│   └── ui/                     # (optional) shared design tokens if both apps benefit
├── pnpm-workspace.yaml
├── turbo.json
└── docker-compose.yml          # local Postgres + both apps for dev/self-hosting
```

Use **pnpm workspaces + Turborepo**. Both apps import `@repo/db` for all database access — never duplicate table definitions in each app.

**Deployment target:** assume self-hosted (a Linux server, not necessarily Vercel) unless told otherwise. Both apps should build with `output: "standalone"` and run as small Docker images behind a reverse proxy (Nginx or Caddy) that terminates TLS and routes each app by subdomain or path. Keep this platform-agnostic — it should also deploy cleanly to Vercel/Render/Fly if that changes later.

---

## 3. Tech stack — decided, with rationale

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16+**, App Router, TypeScript strict mode | Turbopack is the default bundler now; build for it. |
| Database | **PostgreSQL 18+** | Needed for native `uuidv7()` — see §4. |
| ORM | **Drizzle ORM** + `drizzle-kit` | TypeScript-native schema with no code-gen step, which matters here because two separate apps share one schema package. Full SQL control for the admin reporting queries. If the team strongly prefers a more abstracted, schema-first DX, Prisma 7 (its Rust engine is gone, so its old serverless bundle-size penalty is gone too) is an acceptable substitute — but don't mix both. |
| Auth | **Argon2id password hashing + HttpOnly JWT session cookie.** Implement via Auth.js v5 (Credentials provider, JWT strategy, no DB adapter needed) *or* a small custom module — either is fine as long as the contract in §5 holds. | Two completely separate auth realms: Exhibitors and Admins never share a session. |
| Offline / PWA | **Serwist** (`@serwist/next`) | `next-pwa` is unmaintained/archived — do not use it. Serwist is its actively maintained, Turbopack-compatible successor. Pair with Next's built-in `useOffline` hook for connectivity-aware UI where useful. |
| QR decoding | **Progressive enhancement**: native `BarcodeDetector` API where available, falling back to a JS/WASM decoder (e.g. `qr-scanner` or `html5-qrcode`) everywhere else | **Critical:** `BarcodeDetector` is still not implemented in Safari/WebKit, meaning it silently fails on every iPhone. Never ship BarcodeDetector as the only path — a real fraction of exhibitors will be on iOS. |
| QR generation | `qrcode` (npm), generated **on demand** from a stored token, not persisted as image files | See §4 for why the encoded value must not be the row's primary key. |
| Validation | **Zod**, schemas live in `packages/shared` and are imported by both client forms and server actions/route handlers | One source of truth for what a "valid visitor" looks like. |
| Local storage (client) | **IndexedDB** via the `idb` wrapper — not `localStorage` (too small, synchronous, string-only) | Holds the offline scan queue and cached visitor lookups. |
| Styling | **Tailwind CSS v4** (CSS-first config, no `tailwind.config.js` needed) | See §8 for the design system. |
| Tables/charts (admin) | **TanStack Table** + **Recharts** | |
| Badge PDF export | **`@react-pdf/renderer`** | Server-side PDF generation, no headless-browser dependency. |
| File import (bulk) | **`papaparse`** (CSV) and **SheetJS/`xlsx`** (Excel) | |
| Testing | **Vitest** (unit — prioritize the sync engine and validation logic) + **Playwright** (E2E for login/CRUD flows) | Camera/QR scanning itself is impractical to fully automate; keep a short manual QA checklist (§10) for real-device testing, especially one iOS device. |
| Lint/format | **Biome** (fast, single tool) *or* ESLint flat config (`eslint.config.mjs`, not the legacy `.eslintrc.*`) + Prettier | Pick one, enforce it in CI. |

### Do NOT use (explicitly deprecated/unmaintained as of 2026)
- Pages Router (`pages/`), `getServerSideProps`, `getInitialProps`
- `next-pwa` (archived — use Serwist)
- `middleware.ts` as a filename — Next.js 16 renamed this file convention to **`proxy.ts`** (exported function is now `proxy`, not `middleware`; it also now runs on the Node.js runtime rather than being Edge-only). Use `proxy.ts` from the start.
- Relying on `BarcodeDetector` alone for QR scanning
- Class components, `React.FC`, default-exported page components without types
- CommonJS (`require`/`module.exports`) anywhere in application code — ESM only
- Storing passwords, session tokens, or API keys in plaintext, `localStorage`, or client-readable cookies
- A single shared login for all admins — there must be an `admins` table supporting multiple distinct admin accounts

---

## 4. Database schema

Your starting point was:

```
Exhibitor(ExhibitorID PK, Name, UserName UNIQUE, Password, PhoneNumber UNIQUE, CreatedAt)
Visitor(VisitorID PK, QRCode UNIQUE, Name, Company, PhoneNumber, Email, VisitorType DEFAULT 'invited', CreatedAt)
Visit(ExhibitorID FK, VisitorID FK, PK(ExhibitorID, VisitorID), CreatedAt)
```

That's the correct shape. Implement it as below, with these deliberate refinements — each exists to close a real gap, not to gold-plate:

- **Primary keys are UUID, not serial integers.** Specifically UUIDv7 (`uuidv7()`), which Postgres 18 generates natively and which sorts by creation time (far better index/insert locality than random UUIDv4, while still avoiding the "guess the next integer" problem of serial IDs). If the actual deployment target runs an older Postgres, generate UUIDv7 application-side (any current UUID library supports it) and pass it explicitly instead of relying on the column default.
- **The QR code is *not* the primary key.** `Visitor.QRCode` becomes `qr_token`: a separate, independently random, unguessable string (e.g. `gen_random_uuid()`/UUIDv4, or a nanoid), generated once at row creation. This matters because the QR token is the one identifier that leaves the system and becomes physically scannable by anyone — it must never leak the row's creation order (which UUIDv7 does) or be enumerable (which a serial int would be).
- **`Name`, `Company`, `PhoneNumber`, `Email` on `Visitor` are nullable.** Guest rows are created before any of that is known.
- **`Password` is implemented as `password_hash`** — Argon2id hash, never plaintext, on both `exhibitors` and `admins`.
- **An `admins` table**, same shape as `exhibitors` conceptually, fully separate credentials and sessions. Supports multiple admin accounts from day one.
- **An `event_settings` table** (singleton row): business-customer name, uploaded logo URL, and 2–3 brand colors (auto-extracted from the logo, admin-overridable). This is what makes the white-label branding in §8 actually configurable instead of hardcoded. If this deployment will ever need to run more than one event over time without wiping data, that's a clean future extension (an `events` table + `event_id` foreign keys) — don't build that now, just don't do anything that would make it painful to add later.
- **`Visit` gets `scan_count` and `last_scanned_at`** alongside the original composite primary key and `created_at`. You kept the composite PK exactly as specified, which means a given exhibitor can only have one Visit row per visitor — so a re-scan must be an idempotent upsert (`ON CONFLICT (exhibitor_id, visitor_id) DO UPDATE SET scan_count = scan_count + 1, last_scanned_at = now()`) rather than an error. This also makes retried sync requests from the offline queue safe to replay.
- **Prefer soft-delete for admin-side removal of exhibitors/visitors** (a `deactivated_at` timestamp) rather than hard `DELETE`, so historical analytics stay intact. The exhibitor's own "remove from my scanned list" trash button is different — that's a hard delete of just the one `Visit` row, which is exactly what it should do.

```typescript
// packages/db/schema.ts
import { pgTable, pgEnum, uuid, varchar, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const visitorTypeEnum = pgEnum("visitor_type", ["invited", "guest"]);

export const exhibitors = pgTable("exhibitors", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: varchar("name", { length: 200 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull().unique(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  qrToken: varchar("qr_token", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 200 }),
  company: varchar("company", { length: 200 }),
  phoneNumber: varchar("phone_number", { length: 30 }),
  email: varchar("email", { length: 200 }),
  visitorType: visitorTypeEnum("visitor_type").notNull().default("invited"),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visits = pgTable("visits", {
  exhibitorId: uuid("exhibitor_id").notNull().references(() => exhibitors.id),
  visitorId: uuid("visitor_id").notNull().references(() => visitors.id),
  scanCount: integer("scan_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.exhibitorId, t.visitorId] }) }));

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventSettings = pgTable("event_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: varchar("business_name", { length: 200 }),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  secondaryColor: varchar("secondary_color", { length: 7 }),
  accentColor: varchar("accent_color", { length: 7 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Every code path that creates a `Visitor` (manual add, bulk import, guest generation) must go through **one shared insert helper** in `packages/db` that assigns `qr_token` — never duplicate that logic per call site.

---

## 5. Security & auth — the contract

Whether implemented via Auth.js or a custom module, all of the following must hold:

1. **Hashing:** Argon2id for every password, on both `exhibitors` and `admins`. Never bcrypt-only, never plaintext, never MD5/SHA.
2. **Sessions:** HttpOnly + Secure + `SameSite=Lax` cookie holding a signed JWT (via `jose` or your auth library). Minimal payload (id, role, issued/expiry) — no PII in the token. Exhibitor sessions ~24h; admin sessions shorter (e.g. 12h) given the higher blast radius of an admin account.
3. **Defense in depth on route protection.** `proxy.ts` (Next 16's renamed `middleware.ts`) is a fine place to redirect unauthenticated users for UX, but it must **never be the only auth check**. Next.js has shipped a middleware-bypass vulnerability before (CVE-2025-29927, a header that skipped middleware entirely) — so every Server Action and Route Handler that touches real data must independently re-verify the session itself, not assume `proxy.ts` already handled it.
4. **The public visitor-lookup endpoint is intentionally unauthenticated** (see §6 — scanning must work before login), so it must be rate-limited per IP/device to prevent token brute-forcing, on top of `qr_token` already being long and random.
5. **CSRF:** Server Actions get Next.js's built-in Origin-header verification for free. Any custom Route Handler that mutates state must also check the Origin header manually.
6. Admin and Exhibitor auth are **fully separate realms** — different tables, different cookies, different session validation — even though they live in the same monorepo.

---

## 6. Exhibitor PWA — detailed spec

### Screens
1. **Landing/home** — the big circular **Scan** button, dominant and centered. Top bar shows the University of Tehran mark (fixed) and the current business customer's logo (from `event_settings`, admin-uploaded). Top-right: profile avatar/initials if logged in, or a "Sign in" affordance if not. A secondary "Scanned Visitors" entry point with a live count badge.
2. **Login** / **Signup** — username + password; signup collects name, username, phone, password.
3. **Scan (camera) view** — full-screen viewfinder, a scan-region frame overlay (this is the app's signature visual moment — see §8), cancel action, torch toggle if supported, and a manual-entry fallback for a damaged badge.
4. **Visitor description page** — name, company, visitor-type badge (Invited/Guest), tap-to-call phone, tap-to-email email, scan timestamp, and a small sync-status chip ("saved — syncing…" / "synced" / "saved offline"). This page is what a successful scan opens into, and it's also what the scanned-list "view" button opens.
5. **Scanned list** — search box, list of everyone this exhibitor has scanned (name, company, timestamp), each row with a **view** (eye) and **trash** (delete) action. Deleting removes that one `Visit` row — use a toast-with-undo rather than a blocking confirm dialog.
6. **Profile** — exhibitor's own info, sync summary (e.g. "2 pending"), log out.

### The offline-first behavior — this is the core engineering challenge

Requirements, restated precisely: (a) scanning must work even when not logged in, with those interactions kept **only** on the device until login; (b) once logged in, scans save locally first and push to the server as soon as possible, without losing anything; (c) visitor data the exhibitor has looked up should be cached on-device so re-viewing it is instant. Build it like this:

**IndexedDB (via `idb`), two stores:**
- `visitorCache` — keyed by `qrToken`: last-known visitor detail + when it was cached. This is what makes requirement (c) real — every time the app fetches a visitor's info from the server, it writes the result here, so the next time that visitor is viewed (from the scanned list, or re-scanned) it's instant and works offline. This is what "the server caches visitor data on the exhibitor's phone" means in practice: it's the client persisting server responses, not the server pushing anything unprompted.
- `visitOutbox` — an append-only log of scan events, keyed by a client-generated UUID: `{ localId, qrToken, scannedAt, synced }`.

**Scan flow:** decode QR → look up the visitor (check `visitorCache` first — instant and works offline; on a cache miss while online, call the public, unauthenticated `GET /api/visitors/lookup/[qrToken]` and cache the result; on a cache miss while offline, show a "scanned — details will load once you're back online" state) → **write a `visitOutbox` entry immediately**, regardless of login state or connectivity → show the description page.

**Sync engine:** a small client module that flushes `visitOutbox` to `POST /api/visits/sync` whenever the exhibitor is authenticated **and** online. Triggers: right after a scan, on the browser `online` event, on tab `visibilitychange`, and a periodic interval as a safety net. Retries with backoff on failure. If the exhibitor is *not* logged in, entries simply accumulate locally and are never sent — exactly as specified. **On login, immediately flush the entire outbox**, including everything accumulated before the account existed on this device. The sync endpoint must be idempotent (upsert on `(exhibitorId, visitorId)`, see §4) so retried/duplicate sync attempts from a flaky connection never error or double-count.

For a genuinely offline scan (no network at all, not just unauthenticated), the visitor description will show only the token and a pending state until connectivity returns and the lookup resolves — full offline name resolution for *every* visitor would require pre-syncing the entire visitor directory on login, which is a reasonable v2 enhancement if venue Wi-Fi turns out to be unreliable, but isn't required for v1.

**Serwist** handles the service worker, app shell precaching, and installability (manifest, icons). Keep the actual sync logic (above) as your own well-tested module rather than leaning on a generic offline-caching library for it — its semantics here are specific enough that a purpose-built implementation will be easier to reason about and to test than reusing a generic tool for something it wasn't quite designed for.

---

## 7. Admin panel — detailed spec

- **Visitors:** table view (search/filter/sort), manual add form, and bulk import (CSV/XLSX via `papaparse`/SheetJS). Import shows a preview with per-row validation errors and does a **partial-success import** (valid rows go in, invalid rows are reported for correction) rather than all-or-nothing.
- **Guests:** admin enters a count, the system creates that many `visitor_type = 'guest'` rows with blank contact fields and a freshly generated `qr_token` each. Details get filled in later via the same visitor-edit form used for invited visitors.
- **QR generation & mapping:** fully automatic on every visitor-creating path (manual, import, guest generation) via the shared insert helper from §4 — never a separate manual step.
- **Badges / print export:** two distinct templates — Invited (name + company + QR) and Guest (QR only, since name isn't known yet). Generate as print-ready PDFs via `@react-pdf/renderer`, laid out multiple-per-page for standard badge stock, with cut guides.
- **Data export:** CSV/XLSX/JSON export of visitors, exhibitors, and visits from the app itself. (Full raw database backups are an infra concern — `pg_dump` on a schedule — not something the web UI needs to reinvent.)
- **Visualize:** a dashboard with summary counts (total visitors, invited/guest split, total exhibitors, total visits), an exhibitor leaderboard by scan count, and a searchable visitors table that expands to show which exhibitors scanned each one. `Recharts` + `TanStack Table`.
- **Branding:** logo upload for the business customer (validated file type/size, stored to disk or S3-compatible storage), with 2–3 brand colors auto-extracted from the logo (a color-extraction library such as `node-vibrant`) and manually overridable via color pickers. Writes to `event_settings`, which both apps read at render time — see §8.
- **Admin accounts:** admins can view/manage exhibitor accounts (deactivate, not necessarily hard-delete) and manage other admin accounts.

---

## 8. Design system

Dark theme was specified — build it as a real system, not a black background with one accent color slapped on:

- **Two-source gradient, derived at runtime, not hardcoded.** The University of Tehran palette is fixed in code (it never changes across deployments). The business customer's colors come from `event_settings` (§4/§7) and are injected as CSS custom properties on the root layout of both apps. The gradient — and the whole UI's accent system — is built from these variables, so a brand-new deployment for a different company just works once the admin uploads a new logo, with zero code changes.
- **Restraint.** Use the gradient as a glow behind the Scan button and a subtle wash at the top of key screens — not flooding every surface. Dark, near-black elevated surfaces (a couple of tiers, not pure `#000`) do most of the work; the gradient is the accent, not the wallpaper.
- **A signature motif, not a generic template.** The scan-region frame in the camera view (corner brackets, a subtle animated scan-line) is the natural signature element here — it's specific to what this app actually does, reuse its shape/motion language elsewhere (loading states, the Scan button's idle animation) so the app has a visual identity beyond "dark theme with rounded cards."
- **Typography:** pick one distinctive, highly-legible variable sans for UI and body text rather than defaulting to system fonts everywhere — this is a small decision that does a lot of work for how "designed" the app feels. Geist (Vercel's typeface) is a solid, current, free option that pairs naturally with a Next.js stack if nothing else is preferred.
- **Accessibility floor, non-negotiable regardless of how dark/stylized the theme gets:** WCAG-AA contrast for all text, visible keyboard focus states, `prefers-reduced-motion` respected for the scan-line and other animations, and tap targets ≥44×44px throughout (this is a phone-in-hand app used quickly on a busy show floor — small targets are a real usability failure here, not a nitpick).
- Use toasts-with-undo instead of blocking `confirm()` dialogs for destructive-but-recoverable actions (deleting a scanned visitor).

---

## 9. Suggested build order

Build in this order — each phase should be independently testable before moving on:

0. Monorepo scaffold, `packages/db` schema + migrations, `docker-compose.yml` for local Postgres.
1. Auth: exhibitor signup/login, admin login, session contract from §5.
2. Exhibitor PWA core, online-only: landing page, camera + QR decode (with the iOS fallback path), visitor lookup, description page.
3. Offline layer: IndexedDB stores, sync engine, Serwist/PWA installability, the not-logged-in local-only flow.
4. Scanned list (view/delete) and profile.
5. Admin: visitor CRUD (manual + import), guest generation, QR mapping.
6. Admin: dashboard/visualization.
7. Admin: badge export, data export.
8. Branding/theming wired end-to-end across both apps.
9. Polish: accessibility pass, empty/loading/error states, rate limiting, tests, Docker deploy.

---

## 10. Definition of done

- [ ] A visitor can be scanned and viewed **without ever logging in**, and that scan is retrievable locally but absent from the server's `visits` table until login.
- [ ] Logging in flushes every locally-queued scan, and none are lost or duplicated.
- [ ] Killing the network mid-session doesn't lose a scan — it queues and later syncs.
- [ ] Scanning works on a real iPhone in Safari, not just Chrome/Android.
- [ ] Re-scanning the same visitor updates `scan_count`/`last_scanned_at` instead of erroring.
- [ ] No password is ever stored or logged in plaintext.
- [ ] Every data-mutating Server Action/Route Handler checks auth itself, independent of `proxy.ts`.
- [ ] Admin can go from "zero visitors" to a full set of printable, correctly-templated badges (invited + guest) with no manual QR-code step.
- [ ] Uploading a new business-customer logo in admin changes both apps' accent colors without a redeploy.
- [ ] `pnpm lint`, `pnpm typecheck`, and the test suite all pass in CI.

---

Build this now, starting with Phase 0. State any assumption you make explicitly in your first response if you deviate from anything above.
