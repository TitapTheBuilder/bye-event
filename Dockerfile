# Multi-stage production-ready Dockerfile for Exhibition System (Turborepo Monorepo)
# Using ArvanCloud Docker Registry (docker.arvancloud.ir)
#
# Usage:
#   Build Exhibitor app (default): docker build -t exhibitor .
#   Build Admin app:              docker build --build-arg APP_NAME=@repo/admin --build-arg APP_DIR=admin -t admin .

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
    PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/${APP_DIR}/public ./apps/${APP_DIR}/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/${APP_DIR}/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/${APP_DIR}/.next/static ./apps/${APP_DIR}/.next/static

RUN if [ "${APP_DIR}" = "admin" ]; then mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads; fi

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["sh", "-c", "exec node apps/${APP_DIR:-exhibitor}/server.js"]
