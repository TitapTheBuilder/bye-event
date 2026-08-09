# Multi-stage build for a Turborepo workspace app, producing a small
# standalone Next.js image (output: "standalone" in next.config.ts).
# Build from the monorepo root: `docker build -f apps/exhibitor/Dockerfile .`
FROM node:22-slim AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
# FIXED: Changed 'apk add' to 'apt-get' because node:slim is Debian-based
RUN apt-get update && apt-get install -y libc6 && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm config set registry https://registry.npmmirror.com/ && \
    CI=true pnpm install --frozen-lockfile
RUN npx turbo prune @repo/exhibitor --docker

FROM base AS installer
WORKDIR /app
RUN apt-get update && apt-get install -y libc6 && rm -rf /var/lib/apt/lists/*
COPY --from=pruner /app/out/json/ .
RUN pnpm config set registry https://registry.npmmirror.com/ && \
    CI=true pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder values only -- Next's page-data collection step imports
# @repo/db (which requires DATABASE_URL to be *set*, not *reachable*) even
# though every route here is force-dynamic and reads the real value at
# request time. The real DATABASE_URL/SESSION_SECRET come from
# docker-compose.yml at container start.
ENV DATABASE_URL="postgres://build:[REDACTED]@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder"
RUN pnpm turbo run build --filter=@repo/exhibitor

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/exhibitor/public ./apps/exhibitor/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/static ./apps/exhibitor/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# FIXED: Removed the stray "=1" and duplicate CMD
CMD ["node", "apps/exhibitor/server.js"]