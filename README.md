# Exhibition Visitor-Scanning & Management Platform

A production-grade, offline-first exhibition visitor badge scanning and exhibition management platform built with **Next.js 16 (App Router)**, **Turborepo**, **PostgreSQL**, and **Drizzle ORM**.

The platform is designed with an **offline-first architecture** for high-volume trade shows and conferences. Exhibitors can scan visitor badges instantly without relying on a constant internet connection, while event organizers manage attendees, exhibitors, badge generation, and analytics through a hardened admin portal.

---

## Table of Contents
- [Architecture & Monorepo Overview](#architecture--monorepo-overview)
- [PII Data Flow & Security Model](#pii-data-flow--security-model)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Testing & Quality Verification](#testing--quality-verification)
- [Comprehensive Functionality Testing Guide](#comprehensive-functionality-testing-guide)
- [Production Deployment Guide](#production-deployment-guide)
- [Operational Runbooks & Incident Response](#operational-runbooks--incident-response)
- [Security Release Gate](#security-release-gate)

---

## Architecture & Monorepo Overview

The repository is structured as a Turborepo monorepo consisting of two Next.js applications and two shared packages:

```
├── apps/
│   ├── exhibitor/              # Mobile-first PWA for exhibitors (Badge scanner, offline outbox, scanned leads)
│   └── admin/                  # Administrative dashboard (Visitor/Exhibitor management, Badges, Imports/Exports)
├── packages/
│   ├── db/                     # PostgreSQL schema, Drizzle ORM queries, atomic rate limiting, and migrations
│   └── shared/                 # Shared validation schemas (Zod), Argon2id hashing, and JWT session handling
├── deploy/
│   └── Caddyfile               # Production reverse proxy, automatic Let's Encrypt TLS, CSP & security headers
├── compose.dev.yml             # Local development Docker Compose stack
├── compose.production.yml      # Hardened production Docker Compose stack (read-only, non-root, Caddy ingress)
└── docs/                       # Security checklists, deployment guides, and handoff runbooks
```

### Core Architecture Invariants
1. **App Router Only:** No legacy Next.js Pages router or `getServerSideProps`.
2. **Next.js 16 `proxy.ts` Routing Guard:** All route protection and Content Security Policy (CSP) nonce injection occur in `proxy.ts` (the Next.js 16+ standard). Route protection in `proxy.ts` serves as a UX guard (redirects); **every Server Action and Route Handler independently verifies authentication and authorization.**
3. **Completely Isolated Auth Realms:** Admin and Exhibitor authentication realms use distinct tables (`admins` vs `exhibitors`), independent cryptographic signing secrets (`ADMIN_SESSION_SECRET` vs `EXHIBITOR_SESSION_SECRET`), distinct cookie names (`admin_session` vs `exhibitor_session`), and separate TTLs (12 hours for admin, 24 hours for exhibitor).
4. **Argon2id Password Hashing:** All password hashes use OWASP-recommended Argon2id parameters (19 MiB memory, 2 iterations, 1 parallelism). Plaintext passwords, fast hashes (MD5/SHA), and bcrypt are forbidden.
5. **Atomic Postgres Rate Limiting:** All rate limiting (authentication endpoints and public QR lookup) utilizes atomic PostgreSQL buckets (`rate_limit_buckets` table), preventing replica drift and process restart bypasses.
6. **UUIDv7 & High-Entropy QR Tokens:** Primary keys use time-ordered UUIDv7 (`uuidv7()`). Visitor badge QR tokens are separate, unguessable 32-character URL-safe tokens (`nanoid(32)`) completely decoupled from database IDs.

---

## PII Data Flow & Security Model

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as Visitor Badge
    actor Exhibitor as Exhibitor (Mobile PWA)
    participant IDB as IndexedDB (Device Outbox)
    participant Proxy as Caddy / Proxy Guard
    participant API as Exhibitor API Route
    participant DB as Postgres Database
    actor Admin as Admin Portal

    Visitor->>Exhibitor: Scans physical badge QR / 6-digit code
    Exhibitor->>IDB: Write scan to local outbox immediately
    Note over Exhibitor,IDB: PII stays on-device if offline or unauthenticated
    
    alt Online & Authenticated
        Exhibitor->>Proxy: POST /api/visits/sync (Bearer cookie + Origin check)
        Proxy->>API: Forward request with validated headers
        API->>DB: Idempotent upsert on (exhibitor_id, visitor_id) via localId
        DB-->>API: Row updated / inserted
        API-->>Exhibitor: {"status": "synced"}
        Exhibitor->>IDB: Mark scan as synced
    else Offline
        Note over Exhibitor: Scan is held in IndexedDB until connectivity returns
    end

    Admin->>Proxy: GET /api/export (Admin Session Required)
    Proxy->>DB: Fetch aggregated visitor scans
    DB-->>Admin: Neutralized CSV / XLSX download
```

### Data Lifecycle & Retention Policy
- **Client Cache (IndexedDB):** Scans and cached visitor profiles reside in browser IndexedDB. Logging out explicitly clears client-side visitor PII caches to prevent cross-account contamination on shared devices.
- **Database Soft Deletion:** Deleting or deactivating visitors or exhibitors sets `deactivated_at`. Historical visit analytics remain intact while instantly revoking authenticated sessions via session versioning (`session_version`).
- **Formula Neutralization:** All CSV/XLSX export endpoints neutralize potential spreadsheet formula injection payloads (`=`, `+`, `-`, `@`, `\t`, `\r`) with leading single quotes (`'`).

---

## Prerequisites

Ensure your development environment meets the following specifications:
- **Node.js**: `v22.x` or higher
- **Package Manager**: `pnpm` `v11.18.0` (`corepack enable` or `npm install -g pnpm@11.18.0`)
- **Docker & Docker Compose**: For local PostgreSQL database and containerized production staging
- **Operating System**: Linux, macOS, or Windows (WSL2 / PowerShell)

---

## Local Development Setup

### 1. Clone the Repository and Install Dependencies

```bash
git clone <repository-url>
cd bye2
pnpm install
```

### 2. Environment Configuration

Create a `.env` file at the repository root with local development values:

```env
# Database Configuration
DATABASE_URL=postgres://exhibition:exhibition@localhost:5433/exhibition
MIGRATION_DATABASE_URL=postgres://exhibition:exhibition@localhost:5433/exhibition

# Authentication Secrets (Development strings only; production requires 32+ random chars)
ADMIN_SESSION_SECRET=local-admin-development-secret-minimum-32-chars
EXHIBITOR_SESSION_SECRET=local-exhibitor-development-secret-minimum-32-chars

# Application Origins
ADMIN_PUBLIC_ORIGIN=http://localhost:3001
EXHIBITOR_PUBLIC_ORIGIN=http://localhost:3000

# Proxy & Runtime Configuration
TRUST_PROXY=0
ALLOW_INSECURE_DATABASE=1
NODE_ENV=development
```

Next.js applications read `.env` from their respective app root directories. Copy the root `.env` to both applications:

```bash
# On Linux / macOS / Git Bash:
cp .env apps/admin/.env
cp .env apps/exhibitor/.env

# On Windows PowerShell:
Copy-Item .env apps\admin\.env
Copy-Item .env apps\exhibitor\.env
```

### 3. Start PostgreSQL Database

Use Docker to start the isolated PostgreSQL 18 development container:

```bash
# Start PostgreSQL on port 5433
docker-compose -f compose.dev.yml up -d postgres
```

### 4. Run Migrations & Seed Initial Accounts

Apply the Drizzle database migrations and provision initial admin and exhibitor accounts:

```bash
# Apply migrations to database
pnpm db:migrate

# Seed the default Admin account
ADMIN_NAME="System Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="Password123!" pnpm --filter @repo/db seed

# Seed a sample Exhibitor account
EXHIBITOR_FIRST_NAME="Jane" EXHIBITOR_LAST_NAME="Doe" EXHIBITOR_USERNAME="janedoe" EXHIBITOR_PHONE="09120000000" EXHIBITOR_PASSWORD="Password123!" pnpm --filter @repo/db create-exhibitor
```

### 5. Launch Development Servers

Start both Next.js applications in development mode with Hot Module Replacement (Turbopack):

```bash
pnpm dev
```

The applications will be accessible at:
- **Exhibitor Scanning PWA**: [http://localhost:3000](http://localhost:3000)
- **Admin Management Portal**: [http://localhost:3001](http://localhost:3001)

---

## Testing & Quality Verification

The monorepo is covered by 151 unit, integration, and security tests. Run the automated verification commands:

```bash
# Run all Vitest suites across all packages
pnpm test

# Run TypeScript strict type-checking across monorepo
pnpm typecheck

# Run Biome code quality linter
pnpm lint

# Build standalone Next.js production bundles
pnpm build
```

---

## Comprehensive Functionality Testing Guide

### 1. Admin Management Portal Walkthrough (`http://localhost:3001`)

1. **Login:** Navigate to `http://localhost:3001/login` and log in with `admin@example.com` / `Password123!`.
2. **Visitor Management & Guest Generation:**
   - Go to `/visitors` and click **"Add Visitor"** to create an invited visitor.
   - Click **"Generate Guests"** to batch-generate walk-in guest badges with unique 6-digit codes and 32-character QR tokens.
3. **Bulk Visitor Import (CSV / XLSX):**
   - Navigate to `/visitors/import`.
   - Upload a test CSV containing headers: `first name, last name, company, email, phone number`.
   - Preview the validated rows and commit the import.
4. **PDF Badge Generation:**
   - Go to `/badges`, select visitors, and click **"Generate Badges"**.
   - The system renders high-resolution, print-ready badges with embedded QR codes, University of Tehran branding, and full Persian typography rendering (`Vazirmatn`).
5. **Event Branding & Logo Upload:**
   - Navigate to `/branding`.
   - Upload an event logo (PNG, JPEG, or WebP up to 5MB). The system automatically re-encodes the image to a canonical metadata-free PNG, verifies dimensions, and extracts a harmonious brand color palette.
6. **Exhibitor Management & Revocation:**
   - Go to `/exhibitors` to view all registered exhibitor accounts.
   - Click **"Deactivate"** on an exhibitor. Verify that their active sessions are immediately invalidated upon their next server request.

---

### 2. Exhibitor Scanning PWA Walkthrough (`http://localhost:3000`)

1. **Sign Up / Login:**
   - Navigate to `http://localhost:3000/signup` to register a new exhibitor account or log in at `/login`.
2. **Manual 6-Digit Code Lookup:**
   - On the `/scan` screen, enter a visitor's 6-digit short code (e.g. generated from the Admin panel).
   - Verify that the visitor's details are retrieved and displayed on screen.
3. **Camera QR Scanning on Mobile Devices (Local HTTPS):**
   - Mobile browsers (Safari/Chrome) require an HTTPS secure context to access the camera hardware.
   - Generate local certificates and start the mobile development server:
     ```bash
     pnpm --filter @repo/exhibitor dev:mobile
     ```
   - Open `https://<YOUR_LOCAL_IP>:3000` on your smartphone (connected to the same Wi-Fi network), grant camera permissions, and scan a generated visitor badge.
4. **Offline Outbox & Network Resilience Testing:**
   - Open browser DevTools (`F12`) on `http://localhost:3000/scan`.
   - In the **Network** tab, switch throttling to **"Offline"**.
   - Scan or look up a badge, enter notes, and save.
   - Verify in **Application -> Storage -> IndexedDB -> `exhibition-db`** that the scan is stored in the `visitOutbox` with `synced: false`.
   - Switch network back to **"Online"**.
   - Observe the sync indicator change to "Synced" as the background sync engine automatically drains the outbox to PostgreSQL via idempotent sync (`/api/visits/sync`).
5. **Export Scanned Leads:**
   - Navigate to `/scanned` to review all collected leads.
   - Click **"Export CSV"** or **"Export PDF"** to download the visitor list.

---

### 3. Security Boundary Verification

You can execute manual attack-path tests against the running services using `curl`:

```bash
# 1. Verify CSRF Origin Check (Must return 403 Forbidden)
curl -X POST http://localhost:3000/api/visits/sync \
  -H "Origin: https://malicious-site.com" \
  -H "Content-Type: application/json" \
  -d '{"entries":[]}'

# 2. Verify Anonymous Request Protection (Must return 401 Unauthorized)
curl -X GET http://localhost:3001/api/visitors

# 3. Verify Public Lookup Rate Limiting (Atomic Postgres Bucket)
# Triggering rapid repeated QR lookups will return 429 Too Many Requests with Retry-After header:
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/visitors/lookup \
    -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -d '{"token":"non-existent-qr-token-32-chars-long"}'
done
```

---

## Production Deployment Guide

The production topology deploys separate, non-root, read-only Next.js container instances behind a **Caddy** reverse proxy with automatic HTTPS and strict Content Security Policies.

```
                  ┌───────────────────────────────┐
                  │      Internet Traffic         │
                  └──────────────┬────────────────┘
                                 │ :80 / :443
                  ┌──────────────▼────────────────┐
                  │     Caddy Reverse Proxy       │
                  │   (TLS Termination, CSP,      │
                  │    Security Headers, Gzip)    │
                  └───────┬──────────────┬────────┘
                          │              │
        ┌─────────────────▼──┐        ┌──▼──────────────────┐
        │ apps/exhibitor     │        │ apps/admin          │
        │ Next.js Standalone │        │ Next.js Standalone  │
        │ (Port 3000)        │        │ (Port 3000)         │
        └─────────────────┬──┘        └──┬──────────────────┘
                          │              │
                          └───────┬──────┘
                                  │ Private Network
                  ┌───────────────▼───────────────┐
                  │    PostgreSQL 18 Database     │
                  │     (External / Managed)      │
                  └───────────────────────────────┘
```

### Step 1: Server Provisioning & DNS Configuration
1. Provision a Linux server (Ubuntu 22.04 / 24.04 LTS recommended) in a private VPC.
2. Configure DNS records pointing to your server's public IP:
   - `scan.yourdomain.com` (Exhibitor PWA)
   - `admin.yourdomain.com` (Admin Management Portal)
3. Open firewall ports `80` (HTTP) and `443` (HTTPS/QUIC). Ensure all other ports are blocked from the public internet.

### Step 2: Environment & Secret Configuration

Create `/opt/exhibition/.env.production` on the production server with cryptographically strong secrets (32+ bytes generated via `openssl rand -hex 32`):

```env
# Domain Configuration
EXHIBITOR_DOMAIN=scan.yourdomain.com
ADMIN_DOMAIN=admin.yourdomain.com
ACME_EMAIL=security@yourdomain.com

# IP Allowlist for Admin Panel (Restricts Admin domain to office/VPN CIDRs)
# Example: "198.51.100.0/24 203.0.113.50/32" or "0.0.0.0/0" if using Identity-Aware Proxy
ADMIN_ALLOWED_CIDRS=0.0.0.0/0

# Database URLs (External Managed Postgres instance with TLS enabled)
DATABASE_URL=postgres://app_user:StrongPassword@postgres.internal:5432/exhibition?sslmode=verify-full
ADMIN_DATABASE_URL=postgres://admin_user:StrongPassword@postgres.internal:5432/exhibition?sslmode=verify-full
EXHIBITOR_DATABASE_URL=postgres://exhibitor_user:StrongPassword@postgres.internal:5432/exhibition?sslmode=verify-full
MIGRATION_DATABASE_URL=postgres://migrator_user:StrongPassword@postgres.internal:5432/exhibition?sslmode=verify-full

# Cryptographic Session Secrets (MUST be at least 32 characters, never development placeholders)
ADMIN_SESSION_SECRET=e7b4f81c9a3d2e5b8a0f6c4d1e9a7b3c5e8f0a2d4b6c8e0f2a4b6c8d0e2f4a6b
EXHIBITOR_SESSION_SECRET=9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e

# Production Runtime Flags
NODE_ENV=production
TRUST_PROXY=1
ALLOW_INSECURE_DATABASE=0
```

### Step 3: Run Database Migrations

Before starting the web applications, run the one-shot migration container:

```bash
docker compose -f compose.production.yml --env-file .env.production run --rm migrate
```

### Step 4: Launch Production Stack

Start Caddy and both Next.js applications:

```bash
docker compose -f compose.production.yml --env-file .env.production up -d
```

### Step 5: Verify Deployment & TLS

1. Inspect container health statuses:
   ```bash
   docker compose -f compose.production.yml ps
   ```
2. Verify Caddy security headers on the public domain:
   ```bash
   curl -sS -D - -o /dev/null https://scan.yourdomain.com/api/health/live
   ```
   *Expected headers:*
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy: ...`

---

## Operational Runbooks & Incident Response

### 1. Database Backup & Restore Drills

**Creating an Encrypted Backup:**
```bash
pg_dump -h <db-host> -U postgres -F c -f "backup_$(date +%F).dump" exhibition
```

**Restoring from Backup:**
```bash
# 1. Apply baseline migrations
docker compose -f compose.production.yml run --rm migrate

# 2. Restore data idempotently
pg_restore -h <db-host> -U postgres -d exhibition -1 "backup_YYYY-MM-DD.dump"
```

### 2. Immediate Session Revocation & Key Rotation
- **Stolen Admin Credentials:** Delete or deactivate the Admin account in Postgres. The session versioning check in `apps/admin/lib/session.ts` invalidates already-issued cookies within milliseconds.
- **Compromised Signing Keys:** Rotate `ADMIN_SESSION_SECRET` or `EXHIBITOR_SESSION_SECRET` in `.env.production` and restart the corresponding container (`docker compose restart admin exhibitor`). All existing sessions are immediately invalidated.
- **Lost Exhibitor Device:** Deactivate the Exhibitor in the Admin panel. The device will be blocked upon its next network request. Scans stored in local IndexedDB cannot sync to the server under a deactivated account.

---

## Security Release Gate

Before making any internet-facing deployment, review and verify all items in the [Production Security Release Checklist](docs/production-security-checklist.md) and execute the deployment sequence documented in [Production Readiness Handoff](docs/PRODUCTION-READINESS-HANDOFF.md).

For additional operational details, refer to:
- [Production Security Checklist](docs/production-security-checklist.md)
- [Production Deployment Runbook](docs/production-deployment.md)
- [Production Readiness Handoff](docs/PRODUCTION-READINESS-HANDOFF.md)
