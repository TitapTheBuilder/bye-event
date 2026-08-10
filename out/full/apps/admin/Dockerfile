# Multi-stage build for a Turborepo workspace app, producing a small
# standalone Next.js image (output: "standalone" in next.config.ts).
# Build from the monorepo root: `docker build -f apps/admin/Dockerfile .`

ARG BASE_IMAGE=docker.arvancloud.ir/node:22-alpine
ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM ${BASE_IMAGE} AS base
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
RUN npm install -g pnpm@11.18.0

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @repo/admin --docker

FROM base AS installer
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm config set registry ${NPM_CONFIG_REGISTRY} && \
    pnpm config set fetch-timeout 300000 && \
    pnpm config set fetch-retries 10 && \
    pnpm config set network-concurrency 3 && \
    CI=true pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder"
RUN pnpm turbo run build --filter=@repo/admin

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/admin/server.js"]
