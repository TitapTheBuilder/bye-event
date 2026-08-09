# Multi-stage build for a Turborepo workspace app, producing a small
# standalone Next.js image (output: "standalone" in next.config.ts).
# Build from the monorepo root: `docker build -f apps/admin/Dockerfile .`
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN CI=true pnpm install --frozen-lockfile
RUN npx turbo prune @repo/admin --docker

FROM base AS installer
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder values only -- Next's page-data collection step imports
# @repo/db (which requires DATABASE_URL to be *set*, not *reachable*) even
# though every route here is force-dynamic and reads the real value at
# request time. The real DATABASE_URL/SESSION_SECRET/ADMIN_PUBLIC_URL come
# from docker-compose.yml at container start.
ENV DATABASE_URL="postgres://build:[REDACTED]@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder"
RUN pnpm turbo run build --filter=@repo/admin

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/admin/public ./apps/admin/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

# Uploaded logos live here -- matches the `uploads-data` volume mount and
# UPLOADS_DIR in docker-compose.yml, kept out of the standalone Next.js
# public/static output on purpose (see apps/admin/lib/uploads.ts).
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
CMD ["node", "apps/admin/server.js"]
