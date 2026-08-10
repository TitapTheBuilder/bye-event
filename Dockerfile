# Multi-stage production-ready Dockerfile for Exhibition System (Turborepo Monorepo)
# Self-contained with embedded PostgreSQL database for single-container cloud deployment.

ARG BASE_IMAGE=docker.arvancloud.ir/node:22-alpine
ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM ${BASE_IMAGE} AS base
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
RUN npm install -g pnpm@11.18.0

FROM base AS pruner
ARG APP_NAME=@repo/exhibitor
WORKDIR /app
COPY . .
RUN npx turbo prune ${APP_NAME} --docker

FROM base AS installer
ARG APP_NAME=@repo/exhibitor
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm config set registry ${NPM_CONFIG_REGISTRY} && \
    pnpm config set fetch-timeout 300000 && \
    pnpm config set fetch-retries 10 && \
    pnpm config set network-concurrency 3 && \
    pnpm install --no-frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder"
RUN pnpm turbo run build --filter=${APP_NAME}

FROM base AS runner
ARG APP_DIR=exhibitor
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    APP_DIR=${APP_DIR}

RUN apk add --no-cache postgresql postgresql-contrib su-exec

RUN mkdir -p /var/lib/postgresql/data /run/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql

COPY --from=installer /app/apps/${APP_DIR}/public ./apps/${APP_DIR}/public
COPY --from=installer /app/apps/${APP_DIR}/.next/standalone ./
COPY --from=installer /app/apps/${APP_DIR}/.next/static ./apps/${APP_DIR}/.next/static

RUN if [ "${APP_DIR}" = "admin" ]; then mkdir -p /app/uploads && chown -R postgres:postgres /app/uploads; fi

RUN printf '#!/bin/sh\n\
set -e\n\
if [ ! -d "/var/lib/postgresql/data/base" ]; then\n\
    echo "Initializing PostgreSQL data directory and database schema..."\n\
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql\n\
    su-exec postgres initdb -D /var/lib/postgresql/data\n\
    su-exec postgres pg_ctl -D /var/lib/postgresql/data -o "-c listen_addresses='\''localhost'\''" -w start\n\
    su-exec postgres psql --command "CREATE USER exhibition WITH PASSWORD '\''exhibition'\'';"\n\
    su-exec postgres psql --command "CREATE DATABASE exhibition OWNER exhibition;"\n\
    su-exec postgres psql -d exhibition -c "\n\
      CREATE TYPE visitor_type AS ENUM ('\''invited'\'', '\''guest'\'');\n\
      CREATE TABLE IF NOT EXISTS event_settings (\n\
        id integer PRIMARY KEY DEFAULT 1,\n\
        business_name varchar(200),\n\
        logo_url text,\n\
        primary_color varchar(7),\n\
        secondary_color varchar(7),\n\
        accent_color varchar(7),\n\
        updated_at timestamp with time zone DEFAULT now() NOT NULL\n\
      );\n\
      INSERT INTO event_settings (id, business_name) VALUES (1, '\''Exhibition System'\'') ON CONFLICT DO NOTHING;\n\
      CREATE TABLE IF NOT EXISTS admins (\n\
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\
        name varchar(200) NOT NULL,\n\
        email varchar(200) UNIQUE NOT NULL,\n\
        password_hash text NOT NULL,\n\
        created_at timestamp with time zone DEFAULT now() NOT NULL\n\
      );\n\
      CREATE TABLE IF NOT EXISTS exhibitors (\n\
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\
        name varchar(200) NOT NULL,\n\
        username varchar(100) UNIQUE NOT NULL,\n\
        password_hash text NOT NULL,\n\
        phone_number varchar(30) UNIQUE NOT NULL,\n\
        deactivated_at timestamp with time zone,\n\
        created_at timestamp with time zone DEFAULT now() NOT NULL\n\
      );\n\
      CREATE TABLE IF NOT EXISTS visitors (\n\
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\
        qr_token varchar(64) UNIQUE NOT NULL,\n\
        name varchar(200),\n\
        company varchar(200),\n\
        phone_number varchar(30),\n\
        email varchar(200),\n\
        visitor_type visitor_type DEFAULT '\''invited'\'' NOT NULL,\n\
        deactivated_at timestamp with time zone,\n\
        created_at timestamp with time zone DEFAULT now() NOT NULL\n\
      );\n\
      CREATE TABLE IF NOT EXISTS visits (\n\
        exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),\n\
        visitor_id uuid NOT NULL REFERENCES visitors(id),\n\
        scan_count integer DEFAULT 1 NOT NULL,\n\
        created_at timestamp with time zone DEFAULT now() NOT NULL,\n\
        last_scanned_at timestamp with time zone DEFAULT now() NOT NULL,\n\
        PRIMARY KEY (exhibitor_id, visitor_id)\n\
      );\n\
      CREATE TABLE IF NOT EXISTS visit_sync_events (\n\
        local_id uuid PRIMARY KEY NOT NULL,\n\
        exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),\n\
        visitor_id uuid NOT NULL REFERENCES visitors(id),\n\
        scanned_at timestamp with time zone NOT NULL,\n\
        processed_at timestamp with time zone DEFAULT now() NOT NULL\n\
      );\n\
    "\n\
    su-exec postgres pg_ctl -D /var/lib/postgresql/data -m fast -w stop\n\
fi\n\
echo "Starting PostgreSQL server..."\n\
su-exec postgres pg_ctl -D /var/lib/postgresql/data -o "-c listen_addresses='\''localhost'\''" -w start\n\
export DATABASE_URL="${DATABASE_URL:-postgres://exhibition:exhibition@localhost:5432/exhibition}"\n\
export SESSION_SECRET="${SESSION_SECRET:-dev-secret-change-me}"\n\
echo "Starting Next.js server..."\n\
exec node apps/${APP_DIR:-exhibitor}/server.js\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
