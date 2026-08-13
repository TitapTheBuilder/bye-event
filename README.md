# Exhibition System

This repository contains the Exhibition System, consisting of two Next.js applications (`apps/exhibitor` and `apps/admin`) sharing a single Postgres database (`packages/db`).

Before an internet-facing release, complete the [Production Security Release Checklist](docs/production-security-checklist.md). Its P0 items are launch blockers for both applications.

## PII Data Flow & Retention

The following diagram tracks the lifecycle of visitor PII and offline queue caching:

```mermaid
sequenceDiagram
    participant User (Offline)
    participant IndexedDB Outbox
    participant Exhibitor App
    participant Admin Panel
    participant Postgres DB
    
    User (Offline)->>IndexedDB Outbox: 1. Scans badge locally
    Note over IndexedDB Outbox: PII remains on-device only (Checklist 4.5/4.7/4.9)
    IndexedDB Outbox->>Exhibitor App: 2. Auth+Online -> Queue Flushed
    Exhibitor App->>Postgres DB: 3. Idempotent Sync (via `localId`)
    Note over Postgres DB: Data securely stored in visits/visitors
    Postgres DB->>Admin Panel: 4. Export / Review
```

**PII Retention Policy:**
- **IndexedDB**: Offline data (scans and cached visitors) is held indefinitely until it successfully syncs, or the user logs out. Logging out explicitly clears PII from the local cache to prevent cross-account contamination.
- **Database**: Visitor and exhibitor records are soft-deleted via `deactivatedAt` to preserve analytics. Full data retention duration is governed by operational policy. 

## Prerequisites

- **Node.js**: >= 22
- **pnpm**: 11.18.0
- **Docker** and **Docker Compose**: For running the PostgreSQL database (and optionally the apps in production mode).

## Environment Setup

Create a `.env` file in `packages/db` (or globally if you prefer) with the necessary environment variables. For local development with Docker, you can use:

```env
DATABASE_URL=postgres://exhibition:exhibition@localhost:5440/exhibition
SESSION_SECRET=dev-secret-change-me
```

*(Note: In production, ensure you use a strong, unique `SESSION_SECRET`)*

## 1. Start the Database

A `docker-compose.yml` file is provided at the root of the project to run the Postgres database.

To start the database in the background:
```bash
docker-compose up -d postgres
```
*This exposes the database on port `5440` on your host machine.*

Next, generate and run the database migrations so the tables are created:
```bash
pnpm install
pnpm run db:generate
pnpm run db:migrate
```

### Provision Initial Accounts

You must create at least one admin account to use the admin panel, and an exhibitor account to test the scanning flow.

**Create an Admin:**
```bash
ADMIN_NAME="Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="password" pnpm --filter @repo/db seed
```

**Create an Exhibitor:**
```bash
EXHIBITOR_FIRST_NAME="Jane" EXHIBITOR_LAST_NAME="Doe" EXHIBITOR_USERNAME="tech" EXHIBITOR_PASSWORD="password" pnpm --filter @repo/db create-exhibitor
```

---

## 2. Running in Development Mode

To run both applications in development mode with Hot Module Replacement:
```bash
pnpm run dev
```
- **Exhibitor App**: http://localhost:3000
- **Admin App**: http://localhost:3001

### Testing the QR Scanner on Mobile (Local LAN)
The QR Scanner requires a secure context (HTTPS) to access your phone's camera. If you want to test on your phone over the local network, start the exhibitor app with the `dev:mobile` script (which binds to `0.0.0.0` and uses local SSL certificates):
```bash
pnpm --filter @repo/exhibitor dev:mobile
```
*Note: You must have generated `.certs/lan-key.pem` and `.certs/lan-cert.pem` first.*

---

## 3. Running Production Mode Locally (LAN Testing)

If you want to run the fully optimized production builds on your machine and expose them to your local network (e.g. `192.168.x.x`) to login from other devices:

1. **Build the project:**
   ```bash
   pnpm run build
   ```

2. **Start the production server:**
   ```bash
   pnpm start
   ```
Both apps will bind to `0.0.0.0`, making them accessible from other devices on your WiFi.
- **Exhibitor App**: `http://<your-local-ip>:3000`
- **Admin App**: `http://<your-local-ip>:3001`

*(Keep in mind that accessing via HTTP over a local IP will disable the camera scanner on mobile devices. You will need a reverse proxy or tunnel if you need to test the camera in this mode).*

---

## 4. Deploying to Production via Docker Compose

To deploy the production-hardened topology (Caddy reverse proxy + read-only Node.js containers with least-privilege egress), use `compose.production.yml`.

> [!CAUTION]
> Before deploying, you MUST complete the operational tasks documented in the [Production Deployment & Operational Runbook](docs/production-deployment.md). This includes running Staging Section 12 Verification tests, provisioning network firewalls, and documenting MFA exception approvals.

1. Copy `.env.production.example` to `.env.production` and provide real secure values:
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production to set actual domains, secure secrets, and IP allowlists
   ```

2. Build and start the production stack:
   ```bash
   docker-compose -f compose.production.yml --env-file .env.production up -d --build
   ```

3. The system will provision HTTPS via Let's Encrypt automatically. The Admin Panel is restricted exclusively to the `ADMIN_ALLOWED_CIDRS` defined in your environment.
