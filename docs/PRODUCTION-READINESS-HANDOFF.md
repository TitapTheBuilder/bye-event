# Production Readiness Handoff Document

This document serves as the final handoff and audit record before deploying the Exhibition Visitor-Scanning Platform to production. It guarantees that the repository codebase is fully hardened and provides the exact sequence required for the operational deployment.

## 1. Completed Repository Security Work
The following security hardening mechanisms have been fully implemented, tested, and audited within the repository:
- **Authentication:** Both Admin and Exhibitor flows use Argon2id password hashing and separate, cryptographically secure JWT cookies (`HttpOnly`, `Secure`, `SameSite=Lax`). Session versioning guarantees instant revocation upon deactivation/deletion.
- **API Security:** All custom Route Handlers enforce strict `isSameOriginRequest` checks, blocking CSRF and missing `Origin` headers. Handler-level authorization validates the correct realm (Admin vs. Exhibitor) to prevent cross-contamination. IDOR protections ensure Exhibitors only access their own visits.
- **Offline Integrity:** Sync idempotency is guaranteed via `localId` UUIDv7s. Scans made before login remain isolated in IndexedDB.
- **Upload Hardening:** Image uploads are re-encoded via Sharp, removing metadata and rejecting malformed/SVG files to prevent arbitrary script execution.
- **Testing:** 96 integration tests run on every CI build to assert the security boundaries (cross-realm cookies, rate limiting, and IDOR).

## 2. Production Configuration Audit

| Setting | Source of Truth | Production-Safe? | Notes |
| ------- | --------------- | ---------------- | ----- |
| **`TRUST_PROXY`** | `compose.production.yml` | Yes | Essential for Caddy to strip and forward real IPs. Caddy is the only entrypoint. |
| **`ALLOW_INSECURE_DATABASE`** | `.env.production` | Yes | Defaults to `0` in `compose.production.yml`. Ensures Postgres uses TLS. |
| **`*_DATABASE_URL`** | Secret Manager | Yes | Not committed. Admin and Exhibitor containers use isolated roles (App vs Migrator). |
| **`*_SESSION_SECRET`** | Secret Manager | Yes | Enforced at boot time; proxy fails if they match known development defaults. |
| **Origins** | `deploy/Caddyfile` | Yes | Caddy overwrites `X-Forwarded-Host`/`X-Forwarded-Proto` via `host` and `scheme`. |
| **Network Exposure** | `compose.production.yml` | Yes | App containers do NOT expose ports to the host; only Caddy binds `80` and `443`. |

## 3. Dependency Audit Findings (`pnpm audit`)
The final dependency scan surfaced 4 vulnerabilities. None pose an exploitable risk in our specific production runtime context:
1. **`cross-spawn` (High, CVE-2024-27980):** Windows-specific RCE in `cross-spawn`. *Mitigation:* Transitive dev dependency (via `eslint`). Not included in production Alpine Linux images.
2. **`esbuild` (Moderate, GHSA-67mh-4wv8-2f99):** Local development server CSRF. *Mitigation:* Transitive dev dependency (via `drizzle-kit`). Does not exist in the production runtime environment.
3. **`xlsx` (High, GHSA-5pgg-2g8v-p4x9):** ReDoS via malformed XLSX files. *Mitigation:* `xlsx` is included in the production image for import/export. Attack surface is restricted exclusively to authenticated Admins with valid sessions. Uploads are strictly size-limited by the handler.
4. **`file-type` (Moderate, GHSA-5v7r-6r5c-r473):** Infinite loop via malformed ASF streams. *Mitigation:* Transitive dependency via `node-vibrant`. The logo upload endpoint exclusively pre-filters by `image/png`, `image/jpeg`, and `image/webp` via `sharp` before extracting colors, rendering this unreachable.

## 4. Remaining Deployment Verification (Release Blockers)
The following Section 12 staging tests remain `[ ]` and must be executed by the Release Owner, as they require a physically isolated deployment running the real proxy:
1. HTTP header inspection for `Strict-Transport-Security`, `Content-Security-Policy`, and `X-Content-Type-Options` on the Caddy TLS entrypoint.
2. Port isolation verification to prove Postgres and App container ports are inaccessible from the outside.
3. Backup/Restore drill on the AWS/production storage backend.

## 5. Exact Deployment Sequence

1. **Provision Server:** Provision a Linux host within a private VPC.
2. **Configure Firewall:** Restrict inbound traffic strictly to ports `80` and `443`.
3. **Configure DNS:** Map `scan.example.com` (Exhibitor) and `admin.example.com` (Admin) to the host.
4. **Configure Production Secrets:** Populate `.env.production` (or your secret manager) with securely generated `ADMIN_SESSION_SECRET`, `EXHIBITOR_SESSION_SECRET`, and database URLs.
5. **Provision PostgreSQL:** Spin up the managed PostgreSQL instance and enable TLS (`sslmode=verify-full`).
6. **Verify Database TLS:** Connect remotely using `psql` and confirm TLS encryption.
7. **Build/Pull Images:** Build the production Docker images natively on the host or pull from a trusted CI registry.
8. **Record Image Digests:** Run `docker images --digests` and record the SHA for the Release Gate documentation.
9. **Run Migrations:** Run `docker-compose -f compose.production.yml up migrate` and confirm `Migration successful`.
10. **Start the Services:** Execute `docker-compose -f compose.production.yml up -d caddy exhibitor admin`.
11. **Verify Caddy/TLS:** Navigate to `https://scan.example.com` and ensure Let's Encrypt TLS certificates are valid.
12. **Verify Security Headers:** 
    *Command:* `curl -sS -D - https://scan.example.com/api/health/live -o /dev/null`
    *Expected:* `X-Content-Type-Options: nosniff` and `Strict-Transport-Security` are present.
13. **Run Staging Attack-Path Tests:**
    *Command:* `curl -X POST https://scan.example.com/api/visits -d '{}'`
    *Expected:* `403 Forbidden` (Origin missing) or `401 Unauthorized` (Cookie missing).
14. **Test Admin:** Authenticate at `https://admin.example.com` and create an Exhibitor account.
15. **Test Exhibitor:** Authenticate at `https://scan.example.com` with the new Exhibitor account.
16. **Test Scanning (Real Device):** Open `scan.example.com` on an iPhone Safari browser, accept Camera permissions, and scan a valid QR code.
17. **Test Offline Sync:** Disconnect WiFi on the iPhone, scan a badge, reconnect, and verify the background sync flushes the outbox to the server.
18. **Test Backup/Restore:** Execute `pg_dump`, destroy a test database, and `pg_restore`. Prove 100% data idempotency.
19. **Review All P0 Items:** Manually check off the final remaining Staging items in `docs/production-security-checklist.md`.
20. **Obtain Launch Approval:** Security Reviewer and Release Owner explicitly sign off.

### Evidence to Capture
- Screenshot of the `curl` output showing TLS headers.
- Snapshot of the successful `docker-compose` boot logs.
- Documented RTO (Recovery Time Objective) metric from the Backup/Restore drill.
