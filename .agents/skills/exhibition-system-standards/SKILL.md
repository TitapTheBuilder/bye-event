---
name: exhibition-system-standards
description: Use this skill whenever writing, reviewing, refactoring, or planning any code in the exhibition visitor-scanning system repo — the Exhibitor PWA, the Admin Panel, or the shared Drizzle/Postgres schema package. It encodes the architecture, database, security, offline-sync, and design-system rules that must hold across every change to this codebase, not just the initial build. Trigger this any time a file under apps/exhibitor, apps/admin, or packages/ is being touched, or a new feature/table/route is being planned for this project.
---

# Exhibition System — Engineering Standards

Two Next.js apps (`apps/exhibitor`, a scanning PWA; `apps/admin`, an internal tool) sharing one Postgres database via `packages/db`. Full context lives in the project's build specification document — this file is the condensed, standing rule set to apply on every task in this repo, including ones that only touch one small piece of it.

## Architecture invariants — never violate these

- App Router only. Never create a `pages/` directory or use `getServerSideProps`/`getInitialProps`.
- The route-guard file is `proxy.ts` (Next.js 16+), exporting a function named `proxy` — **not** `middleware.ts`/`middleware`. If you ever see `middleware.ts` in this repo, that's legacy and should be migrated, not extended.
- Route protection in `proxy.ts` is UX-only (redirects). It is never the sole auth check — every Server Action and Route Handler must independently re-verify the caller's session before touching data.
- Database schema is defined **only** in `packages/db`. Never declare a table, or a one-off raw-SQL migration that isn't reflected there, inside either app.
- Every code path that creates a `Visitor` row (manual add, bulk import, guest generation) must call the shared insert helper in `packages/db` — never write ad hoc inserts that skip `qr_token` generation.
- Exhibitor auth and Admin auth are fully separate realms: different tables (`exhibitors` vs `admins`), different session cookies, never shared or cross-checked.
- Package manager is pnpm, monorepo is Turborepo. Don't introduce npm/yarn lockfiles.

## Database rules

- Primary keys: UUID (`uuidv7()`), not serial integers.
- `Visitor.qr_token` is a separate, independently-random column from the primary key — never encode or derive the QR content from the row's id, and never make the id itself scannable/public.
- `Visitor.name/company/phone_number/email` are nullable (guest rows start blank).
- Passwords are always `password_hash` (Argon2id). A raw `password` column, or any hashing algorithm other than Argon2id, is a bug to flag immediately, not a style choice.
- `visits` writes must be idempotent upserts on `(exhibitor_id, visitor_id)` — bump `scan_count`/`last_scanned_at` on conflict, never throw on a re-scan of the same pair.
- Prefer soft-delete (`deactivated_at`) over hard `DELETE` for exhibitors/visitors from the admin side, to keep historical visit analytics intact. The one exception: an exhibitor removing an entry from their own scanned list hard-deletes that single `visits` row by design.

## Security rules

- Argon2id for all password hashing, both tables. Never plaintext, never bcrypt-only, never a fast general-purpose hash (MD5/SHA family).
- Session cookie: HttpOnly + Secure + `SameSite=Lax`, minimal JWT payload (id, role, exp), no PII in the token.
- The unauthenticated visitor-lookup endpoint must stay rate-limited per IP/device — it's intentionally public (scanning must work pre-login) so it's the one surface most worth defending.
- Any custom Route Handler that mutates state checks the `Origin` header itself; don't assume Server Actions' built-in CSRF protection covers hand-rolled API routes too.
- Never log a password, session token, or full JWT — including in error messages or crash reports.

## Offline-sync rules

- Client persistence is IndexedDB (`idb`), never `localStorage`, for `visitorCache` and `visitOutbox`.
- A scan writes to the local outbox **immediately**, unconditionally — before any network call, before checking login state.
- The sync engine only pushes queued scans to the server when the exhibitor is authenticated. Not-logged-in scans stay device-local until login, then the *entire* outbox flushes, not just new entries.
- Any new endpoint the sync engine calls must be idempotent — assume it will occasionally be called twice for the same event.
- QR decoding must work on iOS Safari. `BarcodeDetector` alone is not acceptable — it silently does nothing on WebKit. Always keep the JS/WASM fallback path live and tested, don't let it bit-rot behind a feature flag nobody exercises.

## Design-system rules

- Brand colors (business-customer logo + palette) come from the `event_settings` table at runtime via CSS custom properties — never hardcode a specific customer's colors into component code. The University of Tehran mark/palette is the one thing that IS fixed in code.
- Use the brand gradient as an accent (glow behind the Scan button, a subtle top-of-screen wash) — not as a full-bleed background on every surface.
- Tap targets ≥44×44px everywhere in the exhibitor app (used one-handed, quickly, on a show floor).
- Respect `prefers-reduced-motion` for the scan-line/scan-region animation and any other motion.
- Destructive-but-recoverable actions (deleting a scanned visitor) get a toast-with-undo, not a blocking `confirm()`.

## Code quality gates — before considering any task done

- `pnpm typecheck` passes (TypeScript strict mode, no `any` introduced without a comment explaining why).
- `pnpm lint` passes.
- No new CommonJS (`require`/`module.exports`) in application code.
- No new class components.
- If you touched the sync engine, the offline queue, or any auth/session logic, add or update a Vitest test for it — these are the highest-risk-of-silent-bug areas in this codebase.

## When something is ambiguous

Default to the more secure, more offline-resilient, more idempotent option, and say what you assumed in your response rather than silently picking one. Don't block on asking — this project's full spec already resolves almost every open question; re-derive from the invariants above before treating something as genuinely unresolved.
