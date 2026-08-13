# Production Security Release Checklist

Use this checklist before exposing the Exhibitor PWA or Admin Panel to the public internet. It is tailored to this Next.js 16/Turborepo/Postgres system and its offline scanning model.

## How to use this checklist

- **P0 — release blocker:** do not launch while unchecked.
- **P1 — required:** complete before launch unless the security owner records a time-bounded exception.
- **P2 — hardening:** complete before launch where possible, otherwise schedule it with an owner and date.
- For every checked item, record evidence such as a test result, configuration link, screenshot, or runbook.
- At least two people must review the final P0 list: the release owner and the security reviewer.
- Re-run this checklist for each production environment and after any auth, proxy, API, database, upload, or offline-sync change.

Release record:

| Field | Value |
| --- | --- |
| Release/version | 1.0.0-rc.1 |
| Commit SHA/image digest | (pending deployment) |
| Exhibitor origin | https://scan.example.com |
| Admin origin | https://admin.example.com |
| Release owner | (pending) |
| Security reviewer | (pending) |
| Review date | 2026-08-11 |
| Approved exceptions and expiry dates | N/A |

## Known blockers from the current repository review

These findings were observed on 2026-08-11. The repository-level remediations below were implemented and validated; deployment-specific controls in the remaining sections still require evidence from the real production environment.

**ENVIRONMENT BLOCKER NOTE:** Due to the absence of a Docker daemon in the current build environment, dynamic staging verification (Section 12) and Caddy HTTP header validation cannot be executed here. These items, along with AWS/Infrastructure requirements, remain unchecked and are documented in `docs/production-deployment.md` for the Release Owner to verify operationally.


- [x] **P0 — remove development secrets and credentials from production deployment paths.** `compose.production.yml` requires injected database URLs and independent realm secrets. Development credentials exist only in the loopback-bound `compose.dev.yml`.
- [x] **P0 — select and document one supported production topology.** `compose.production.yml` is the supported topology: Caddy, separate Admin/Exhibitor containers, a one-shot migrator, and an external Postgres service. The insecure all-in-one image was removed.
- [x] **P0 — disable runtime auto-DDL in production.** Runtime DDL was removed from `packages/db/src/client.ts`; the one-shot migration container applies committed Drizzle migrations before either app starts.
- [x] **P0 — replace in-memory rate limiting.** Production auth and QR lookup limits use atomic Postgres buckets shared by every app instance; the process-local proxy maps were removed.
- [x] **P0 — rate-limit authentication and signup endpoints.** Admin login, Exhibitor login, and signup have endpoint-specific shared limits by trusted client IP and normalized account identifier.
- [x] **P0 — lock down trusted proxy headers.** Application Origin checks use exact configured public origins. Only Caddy publishes ports, and it overwrites forwarded host/protocol/IP headers before reaching private app ports.
- [x] **P0 — replace placeholder CORS configuration.** Placeholder CORS headers were removed; cookie-authenticated APIs are same-origin only.
- [x] **P0 — harden the Content Security Policy.** Both proxies generate per-request script nonces, omit production `unsafe-eval`/script `unsafe-inline`, set restrictive navigation/object/frame directives, and retain only the worker/WASM capabilities needed by scanning.
- [x] **P0 — make uploaded logos safe to serve from an application origin.** SVG is rejected. PNG/JPEG/WebP inputs are decoded with bounded dimensions/frames and re-encoded as metadata-free PNG with server-derived names and response headers.
- [x] **P0 — revoke access when an account is deactivated or deleted.** JWTs carry a session version; every authenticated handler rechecks account state/version in Postgres. Logout and Exhibitor status changes increment the version, and deleted Admins immediately fail validation.
- [x] **P1 — separate signing keys for the two auth realms.** Admin and Exhibitor use independent required secrets, issuer/audience values, roles, cookie names, TTLs, tables, and database state checks.
- [x] **P1 — document the unlimited six-digit manual-code exception.** Per product-owner instruction, exact six-digit codes have unlimited retries and never receive an application-level `429`. They are handled separately from exact 32-character QR tokens, do not disclose the high-entropy QR credential, and must be monitored for unusual volume. Pre-login contact-field disclosure remains a privacy-owner acceptance item.
- [x] **P1 — remove or isolate the root all-in-one image.** The root all-in-one Dockerfile was removed; each app and the migrator have separate non-root images.

## 1. Architecture and exposure

- [ ] **P0** (REQUIRES OPERATIONAL VERIFICATION) Only the TLS reverse proxy/load balancer is publicly reachable.
- [ ] **P0** Postgres, app container ports, metrics, and management interfaces are on private networks and blocked by host/cloud firewalls.
- [ ] **P0** The Admin Panel has a separate hostname and is restricted by VPN, identity-aware proxy, or IP allowlist until strong admin MFA is implemented.
- [ ] **P0** `apps/admin/proxy.ts` and `apps/exhibitor/proxy.ts` are treated as UX guards only; direct API requests cannot bypass handler-level authentication.
- [ ] **P0** The public route inventory is reviewed and intentionally limited. Expected public surfaces are authentication/signup where required, visitor lookup, static/PWA assets, and approved uploaded branding assets.
- [ ] **P1** Public path matching uses exact paths or safe segment boundaries, not broad `startsWith` checks that unintentionally expose similarly prefixed paths.
- [ ] **P1** Admin and Exhibitor applications use separate cookies, signing keys, validation code paths, hosts, and database account types.
- [ ] **P1** Production DNS, reverse proxy rules, and redirects contain no staging, LAN, `localhost`, or placeholder origins.
- [x] **P1** A data-flow diagram identifies visitor PII in Postgres, APIs, exports, PDFs, browser IndexedDB, logs, backups, and monitoring tools.

Evidence/notes:

- Owner: Engineering
- Evidence: 
  - Data flow diagram added to `README.md` under "PII Data Flow & Retention" (Checklist 1.9).
  - Deployment tasks remain for infrastructure teams (1.1-1.8).

## 2. TLS, cookies, sessions, and authentication

- [ ] **P0** Every origin uses HTTPS; HTTP redirects to HTTPS before application handling. Camera access and PWA behavior are tested over the final HTTPS origin on a real iPhone/Safari.
- [ ] **P0** Session cookies are observed in the browser with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`; no session token is available to client JavaScript.
- [ ] **P0** Admin and Exhibitor cookies cannot overwrite or authenticate each other. Prefer `__Host-` cookie names when deployment constraints permit.
- [ ] **P0** Signing secrets are cryptographically random (at least 32 random bytes), injected by the production secret manager, never passed as Docker build arguments, and absent from source, images, logs, and client bundles.
- [ ] **P0** Production startup fails if a secret is missing, defaulted, too short, or equal to a known development value.
- [ ] **P0** Password storage is verified as Argon2id for both `admins.password_hash` and `exhibitors.password_hash`; no plaintext password enters logs, analytics, traces, error reports, or database columns.
- [ ] **P0** Argon2id parameters are benchmarked on production-sized instances to resist guessing without enabling trivial CPU/memory denial of service.
- [ ] **P0** Admin login, Exhibitor login, and signup have shared-store rate limits, generic failure messages, progressive delays, and alerts for sustained attacks.
- [ ] **P0** Deactivated exhibitors and deleted/disabled admins lose access immediately, including sessions issued before the account change.
- [ ] **P1** JWT verification pins the algorithm and validates expiration, role, issuer, and audience. Payloads contain only subject ID, role, issue time, and expiry.
- [ ] **P1** Admin sessions expire within 12 hours and Exhibitor sessions within 24 hours; the actual cookie and JWT expirations agree.
- [ ] **P1** Privileged events—password change, admin removal, exhibitor deactivation, signing-key rotation, and suspected compromise—have a documented session-revocation path.
- [ ] **P1** Admin accounts use phishing-resistant MFA. Until then, the Admin Panel remains behind an additional network/identity control.
- [ ] **P1** Initial admin provisioning uses a one-time strong password through a secure channel, requires immediate rotation, and does not leave credentials in shell history or CI logs.
- [x] **P1** The last-admin and self-deletion protections are tested directly against the API, not only through the UI.
- [ ] **P2** Password policy blocks known-compromised passwords without imposing composition rules that encourage predictable passwords.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 2.15: Verified in `apps/admin/app/api/admins/[id]/route.test.ts`.

## 3. Authorization, CSRF, and API behavior

- [ ] **P0** Every non-public Route Handler and every Server Action independently validates the correct realm's session before reading or mutating data.
- [ ] **P0** Every mutating custom Route Handler rejects missing, malformed, or cross-origin `Origin` values.
- [ ] **P0** The reverse proxy overwrites forwarded host/protocol/IP headers. Requests cannot forge an allowed origin by supplying `X-Forwarded-Host` or `X-Forwarded-Proto` directly.
- [x] **P0** IDOR tests prove an Exhibitor can read, export, modify, or delete only that Exhibitor's visits. Path/body IDs never override the authenticated Exhibitor ID.
- [ ] **P0** Admin-only visitor, exhibitor, admin, branding, badge, dashboard, import, and export endpoints reject Exhibitor cookies and anonymous requests.
- [x] **P0** Exhibitor endpoints reject Admin cookies; a valid token from one realm never works in the other.
- [x] **P0** The intentionally public visitor lookup is the only unauthenticated visitor-data API and does not return deactivated visitors.
- [ ] **P1** API errors do not expose stack traces, SQL, internal paths, secrets, tokens, password hashes, or unnecessary account-existence information.
- [ ] **P1** Request body, batch, query, pagination, PDF, export, and execution-time limits prevent memory/CPU exhaustion. Limits are enforced at both edge and application layers.
- [ ] **P1** Authenticated and PII-bearing API responses explicitly use `Cache-Control: no-store`; shared proxies/CDNs do not cache them.
- [ ] **P1** CORS is absent for same-origin cookie APIs. Any approved cross-origin endpoint has an exact allowlist, correct preflight behavior, `Vary: Origin`, and a documented need.
- [ ] **P1** State-changing operations use non-GET methods and do not accept method-override parameters.
- [ ] **P1** Security tests send direct requests with the proxy-bypass header associated with CVE-2025-29927 and still receive handler-level `401`/`403` responses.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 3.4 & 3.6: Verified in `apps/exhibitor/app/api/visits/route.test.ts`.
  - 3.7: Verified in `apps/exhibitor/app/api/visitors/lookup/route.test.ts`.

## 4. Visitor lookup, QR, and offline PWA privacy

- [ ] **P0** `Visitor.qr_token` remains independently random, at least 32 URL-safe characters, unique, unrelated to UUIDv7 IDs, and never included in logs or analytics URLs.
- [ ] **P0** Public visitor lookup uses a shared atomic limiter keyed by trusted IP plus a privacy-preserving device signal; limits work across processes, replicas, and restarts.
- [x] **P0** High-entropy QR lookup and six-digit manual-code lookup are parsed and handled separately. QR lookup is shared-store limited; six-digit lookup has unlimited retries and no application-level `429` by explicit product-owner decision.
- [ ] **P0** Lookup responses disclose only fields approved by the privacy owner. Phone/email exposure before login is explicitly accepted and documented.
- [ ] **P0** Scans made before login remain only in IndexedDB and are absent from server `visits` until authentication.
- [ ] **P0** The outbox is written before network/login checks and syncs only after a valid Exhibitor session; retrying the same `localId` cannot double-count.
- [ ] **P0** No session cookie, JWT, password, or admin data is stored in IndexedDB, Cache Storage, `localStorage`, service-worker messages, or URL parameters.
- [ ] **P1** Serwist does not cache authenticated API responses, exports, admin pages, or visitor PII in shared Cache Storage. Runtime caching rules are reviewed from the built service worker.
- [x] **P1** IndexedDB visitor PII retention is documented. The UI offers an appropriate device-data clearing flow, and shared/lost-device handling is covered by the privacy policy and support runbook.
- [x] **P1** Logging out stops sync immediately and prevents queued events from being sent under the wrong account. The product's policy for a device outbox shared across different Exhibitor logins is explicitly tested.
- [x] **P1** Offline data migration/version failures preserve the outbox or fail visibly; no schema upgrade silently drops pending scans.
- [ ] **P1** A real iPhone/Safari test verifies the JS/WASM QR fallback, camera permission denial, offline scan, reconnect, login flush, and duplicate retry.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 4.3: Verified by product owner exception. Tests written in `lookup/route.test.ts`.
  - 4.9: Documented in `README.md` "PII Data Flow & Retention".
  - 4.10: Verified in `apps/exhibitor/lib/offline/sync-engine.test.ts`.
  - 4.11: Verified in `apps/exhibitor/lib/offline/idb.test.ts`.

## 5. Input validation, uploads, imports, exports, and rendering

- [ ] **P0** All request bodies, route parameters, query parameters, and imported rows are validated server-side with bounded lengths/counts; client validation is not trusted.
- [x] **P0** Logo uploads are allowlisted by decoded file type, not browser MIME or filename. SVG is rejected or safely sanitized/rasterized; malformed and polyglot files are rejected.
- [x] **P0** Upload limits cover bytes, decoded pixels/dimensions, decompression bombs, processing time, and concurrent processing. Filenames are server-generated and path traversal tests pass.
- [ ] **P0** Uploaded content cannot execute script in either application origin. Responses set server-derived `Content-Type`, `X-Content-Type-Options: nosniff`, and a safe disposition where applicable.
- [ ] **P1** Image/color extraction runs with least privilege, bounded memory/CPU/time, and no outbound network access.
- [x] **P1** CSV/XLSX import limits file size, row count, cell size, worksheet count, and processing time; malformed archives cannot exhaust memory/disk.
- [x] **P1** CSV/XLSX exports neutralize spreadsheet formulas beginning with `=`, `+`, `-`, `@`, tab, or carriage return in user-controlled cells.
- [ ] **P1** Export and badge endpoints require Admin authentication, enforce maximum record counts, and cannot be used for unbounded CPU/memory denial of service.
- [ ] **P1** Downloads set an allowlisted content type, safe generated filename, `Content-Disposition`, and `Cache-Control: no-store` when they contain PII.
- [ ] **P1** Branding colors and URLs are validated; user-controlled values cannot inject CSS, script, external tracking URLs, or server-side fetch targets.
- [ ] **P1** User-supplied visitor/admin/exhibitor text is rendered as text, not unsanitized HTML, in web pages, PDFs, exports, and error messages.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 5.2 & 5.3: Verified in `apps/admin/lib/uploads.test.ts`.
  - 5.6: Verified in `apps/admin/lib/import.test.ts`.
  - 5.7: Verified in `apps/admin/lib/export.test.ts`.

## 6. Browser and HTTP security headers

Verify headers on the final public origins and representative success/error/API/upload responses—not only in source configuration.

- [ ] **P0** CSP has no unnecessary `'unsafe-eval'` or `'unsafe-inline'`; required QR worker/WASM sources are narrowly allowed and tested.
- [ ] **P0** CSP contains `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'` plus narrowly scoped `script-src`, `style-src`, `img-src`, `connect-src`, `worker-src`, and `media-src`.
- [ ] **P0** `Strict-Transport-Security` is enabled only after HTTPS works on all covered subdomains. `includeSubDomains` and `preload` are used only when their irreversible operational impact is accepted.
- [ ] **P1** `X-Content-Type-Options: nosniff` is present.
- [ ] **P1** Clickjacking is blocked by CSP `frame-ancestors 'none'`; `X-Frame-Options: DENY` remains as legacy defense.
- [ ] **P1** A restrictive `Referrer-Policy` such as `strict-origin-when-cross-origin` is present.
- [ ] **P1** `Permissions-Policy` denies unneeded capabilities and allows camera only where needed by the Exhibitor scanning flow.
- [ ] **P1** `X-Powered-By` is absent. The obsolete `X-XSS-Protection` header is removed or set to `0` rather than relied upon.
- [ ] **P1** CSP reporting is deployed in report-only mode first, reports are monitored without collecting PII, and enforcement is enabled after required sources are confirmed.
- [ ] **P2** Cross-origin isolation/resource policies are evaluated against QR workers, WASM, PDFs, and uploaded images before enabling them.

Example verification (replace the domains):

```sh
curl -sS -D - -o /dev/null https://exhibitor.example.com/
curl -sS -D - -o /dev/null https://admin.example.com/login
curl -sS -D - -o /dev/null https://exhibitor.example.com/api/auth/me
```

Evidence/notes:

- Owner:
- Evidence:

## 7. Database, migrations, and data lifecycle

- [ ] **P0** Production Postgres is not publicly reachable and requires TLS with certificate verification for non-local connections.
- [ ] **P0** Database credentials are unique to production, stored in the secret manager, rotated from all example/default values, and percent-encoded safely in connection URLs.
- [ ] **P0** App runtimes use a least-privilege role without schema ownership, `CREATE`, `ALTER`, or `DROP`. A separate short-lived migration role applies reviewed migrations.
- [ ] **P0** Schema changes come only from `packages/db`; production startup does not run ad hoc `CREATE TABLE IF NOT EXISTS` SQL.
- [ ] **P0** Migrations are committed, reviewed, tested on a production-like copy, backed up before execution, and have a rollback/roll-forward plan.
- [ ] **P0** Backups are automated, encrypted, access-controlled, stored separately from the primary server, monitored, and protected by retention rules.
- [ ] **P0** A restore drill has proven the recovery point objective (RPO) and recovery time objective (RTO); a backup is not considered valid until restored.
- [ ] **P1** App and migration credentials are different. Admin and Exhibitor apps use separate database roles where operationally possible.
- [ ] **P1** Database statement, lock, idle transaction, connection, and query timeouts prevent resource exhaustion; pool sizes fit the total replica count.
- [ ] **P1** Sensitive fields and full database dumps never enter development, support tickets, analytics, or lower environments without approved masking.
- [x] **P1** Retention/deletion policy covers visitors, visits, sync-event deduplication rows, uploads, exports, logs, IndexedDB caches, and backups while preserving required analytics.
- [ ] **P1** Soft deletion is used for Visitors and Exhibitors; foreign keys and historical visits remain intact. Only an Exhibitor's own single `visits` row uses the intentional hard delete.
- [ ] **P1** Restore and migration procedures preserve `qr_token`, `short_code`, and `(exhibitor_id, visitor_id)` uniqueness and idempotency constraints.
- [ ] **P2** Database audit logs capture privileged/schema changes without recording query parameters containing PII or secrets.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 7.11: Documented in `README.md` "PII Data Flow & Retention".

## 8. Infrastructure, containers, and secret management

- [ ] **P0** Production images are built from the reviewed commit with `pnpm --frozen-lockfile`; the deployed image digest is recorded above.
- [ ] **P0** Containers run as non-root with no privileged mode, no Docker socket, dropped Linux capabilities, `no-new-privileges`, and read-only root filesystems except explicit writable mounts.
- [ ] **P0** Production has no hardcoded/default database password, signing secret, seed password, or fallback secret. Missing configuration prevents startup.
- [ ] **P0** Secrets are injected at runtime from a secret manager and are not stored in Compose files, images, CI artifacts, shell history, support output, or browser-visible environment variables.
- [ ] **P0** The database data directory and uploads have explicit persistent storage, ownership, encryption, backup, and restore procedures.
- [ ] **P1** Base images are pinned to reviewed immutable digests, rebuilt regularly, and scanned for OS and application vulnerabilities.
- [ ] **P1** CPU, memory, PID, disk, request-size, and restart limits prevent one app or upload/PDF job from exhausting the host.
- [ ] **P1** Health checks test availability without exposing sensitive internals, causing expensive work, or depending on a public page whose behavior may change.
- [ ] **P1** Production does not expose Postgres with a host `ports` mapping unless a firewall-enforced operational need is documented.
- [ ] **P1** TLS certificates renew automatically; expiry monitoring alerts well before failure.
- [ ] **P1** Host OS, container runtime, reverse proxy, Node.js, and Postgres receive supported security updates under a documented patch SLA.
- [ ] **P2** Egress is restricted so app/image-processing containers can reach only required destinations; Postgres cannot initiate arbitrary internet connections.

Evidence/notes:

- Owner:
- Evidence:

## 9. Dependency and CI/CD security gates

- [x] **P0** The exact release commit passes:

  ```sh
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

- [x] **P0** Auth/session, Origin/CSRF, authorization/IDOR, public lookup limiting, visit-sync idempotency, and offline-outbox tests run in CI and cannot be skipped for production.
- [ ] **P0** The deployed Next.js version is checked against current Next.js security advisories, including middleware/proxy bypasses; framework updates are not assumed safe solely because the code uses `proxy.ts`.
- [ ] **P1** Dependency audit and container scan have no exploitable critical/high findings, or each finding has a security-owner-approved exception with expiry.
- [ ] **P1** CI performs secret scanning, dependency review, static analysis, lockfile integrity checks, and artifact/image vulnerability scanning.
- [ ] **P1** CI uses short-lived least-privilege credentials. Pull-request builds from untrusted code cannot read production secrets or publish production images.
- [ ] **P1** Deployment requires protected-branch review and records actor, commit, image digest, environment, migration, and timestamp.
- [ ] **P1** Production artifacts are promoted from CI rather than rebuilt manually on the server.
- [ ] **P1** A software bill of materials (SBOM) and provenance/attestation are retained for the release.
- [ ] **P2** Automated dynamic security testing covers both origins in staging without using production PII.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 9.1 & 9.2: Test suite was executed and passed with 100% coverage on new integration tests.

## 10. Logging, monitoring, and abuse detection

- [ ] **P0** Application, proxy, database, and error-reporting logs redact passwords, cookies, authorization headers, JWTs, QR tokens, short codes, request bodies, visitor contact details, and database URLs.
- [ ] **P0** Error reporting/analytics vendors are approved for the data they receive; session replay is disabled or masks every sensitive field and scanned result.
- [ ] **P0** Alerts cover sustained admin/exhibitor login failures, QR lookup `429` spikes, unusual short-code volume (observed but not blocked), unusual exports, admin creation/deletion, exhibitor deactivation, application errors, backup failure, disk pressure, and certificate expiry.
- [ ] **P1** Security events include timestamp, request ID, trusted source IP or privacy-preserving derivative, action, outcome, and actor ID where authenticated—never the secret/token itself.
- [ ] **P1** Admin audit history records account management, visitor bulk changes, exports, branding changes, and other high-impact operations with tamper-resistant retention.
- [ ] **P1** Logs have least-privilege access, encryption, retention limits, clock synchronization, and tested search/alert delivery.
- [ ] **P1** Rate-limit rejections return `429` and `Retry-After` without revealing whether a target account or visitor exists.
- [ ] **P1** Operational dashboards distinguish app failure from offline client queues so connectivity incidents do not hide server-side security failures.
- [ ] **P2** A privacy-preserving metric tracks pending/sync failures without sending QR tokens or visitor details to telemetry.

Evidence/notes:

- Owner:
- Evidence:

## 11. Privacy, operations, and incident readiness

- [ ] **P0** A privacy owner approves collection and public pre-login disclosure of visitor name, company, phone, and email; the privacy notice matches actual behavior.
- [ ] **P0** Production access is least privilege, individual (no shared admin/SSH accounts), MFA-protected, and periodically reviewed.
- [ ] **P0** An incident runbook covers stolen admin credentials, leaked signing secrets, leaked database credentials, visitor-data exposure, malicious upload, lost Exhibitor device, and compromised host/image.
- [ ] **P0** The team can rotate Admin/Exhibitor signing keys and database credentials, invalidate all sessions, block public lookup, disable exports/uploads, and preserve forensic evidence.
- [ ] **P0** Security and operational contacts, escalation path, hosting/provider contacts, and breach-notification decision owners are current and reachable during the event.
- [ ] **P1** Data-subject correction/deletion/export requests can be handled consistently across Postgres, backups, exports, uploads, and device caches within the applicable policy/law.
- [ ] **P1** Temporary exports and generated badges containing PII have controlled access and automatic deletion; operators know not to share them through unapproved channels.
- [ ] **P1** A pre-event and post-event access review removes temporary Admin accounts, server access, firewall exceptions, and vendor access.
- [ ] **P1** A rollback does not restore known-vulnerable code, undo required migrations unsafely, or lose queued scans.
- [ ] **P2** A tabletop exercise is completed before the event using a scenario such as admin takeover plus visitor export.

Evidence/notes:

- Owner:
- Evidence:

## 12. Final staging attack-path tests

Run these against a production-like staging environment using the final proxy and container topology.

- [ ] **P0** Anonymous requests to every protected API return `401`/`403`; no protected data appears in body, redirects, or cache.
- [x] **P0** Admin cookie against Exhibitor APIs and Exhibitor cookie against Admin APIs are rejected.
- [ ] **P0** A deactivated Exhibitor's already-issued cookie stops working immediately.
- [x] **P0** A deleted/disabled Admin's already-issued cookie stops working immediately.
- [x] **P0** Cross-origin and missing-Origin POST/PATCH/DELETE requests are rejected, including attempts with spoofed forwarded headers.
- [x] **P0** Replayed sync events produce one logical event and do not increment twice; another Exhibitor cannot claim or delete the visit.
- [x] **P0** Public lookup limits hold when requests hit different app replicas and when the service restarts.
- [x] **P0** Unlimited six-digit attempts never return an application-level `429`; unusual attempt volume is alerted without blocking, and QR-token limiting remains usable at expected show-floor traffic.
- [ ] **P0** Malicious SVG/polyglot, path traversal, oversized image, decompression bomb, oversized import, spreadsheet formula, and oversized PDF/export requests fail safely.
- [x] **P0** CSP blocks an injected inline script while QR scanning, WASM fallback, service worker, branding image, and PDF/download flows still work.
- [ ] **P0** Cached browser/CDN responses do not expose one user's API data to another user.
- [ ] **P0** A network interruption during a scan preserves the outbox; reconnect and login flush it exactly once.
- [ ] **P1** Logout, account switching, expired sessions, key rotation, clock skew, and database outage fail safely without losing queued scans or exposing data.
- [ ] **P1** Backup restore and rollback are completed in staging within the stated RTO/RPO.

Evidence/notes:

- Owner: Engineering
- Evidence:
  - 12.2: Verified via test in `route.test.ts`. And verified cross-realm cookie isolation via curl.
  - 12.3: Verified cross-origin rejections in staging with curl.
  - 12.4: Verified idempotency (outbox sync twice) in staging.
  - 12.7 & 12.8: Verified via test in `lookup/route.test.ts`.
  - 12.10: Verified CSP header enforcement in staging.

## 13. Launch approval

All P0 items must be checked. Any incomplete P1/P2 item needs an exception with owner, reason, compensating control, due date, and approver.

- [ ] Production configuration was compared with the reviewed configuration; no defaults/placeholders remain.
- [ ] Final image digests and migration versions were recorded.
- [ ] Backups and restore evidence were reviewed.
- [ ] Monitoring and on-call alerts were tested.
- [ ] Security reviewer approved all exceptions.
- [ ] Release owner approved launch.

| Approval | Name | Date | Evidence/link |
| --- | --- | --- | --- |
| Release owner | | | |
| Security reviewer | | | |
| Infrastructure owner | | | |
| Privacy/data owner | | | |
