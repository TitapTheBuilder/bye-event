# Exhibition System

This repository contains the Exhibition System, consisting of two Next.js applications (`apps/exhibitor` and `apps/admin`) sharing a single Postgres database (`packages/db`).

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
EXHIBITOR_NAME="Tech Corp" EXHIBITOR_USERNAME="tech" EXHIBITOR_PASSWORD="password" pnpm --filter @repo/db create-exhibitor
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

## 4. Running entirely via Docker Compose

To run the entire stack (Database, Admin App, and Exhibitor App) in isolated containers, simply run:
```bash
docker-compose up -d
```
This is the recommended way to deploy the application to a production server. It will automatically build the Next.js Dockerfiles and start them.
