FROM docker.arvancloud.ir/node:22-alpine AS base

# 1. Dependency Pruning Phase (using turborepo)
FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@11.18.0 turbo
COPY . .
RUN turbo prune @repo/exhibitor --docker

# 2. Install Phase
FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
ENV NODE_ENV=production
RUN pnpm turbo run build --filter=@repo/exhibitor

# 3. Production Runner Phase
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create unprivileged user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/static ./apps/exhibitor/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/public ./apps/exhibitor/public

# Make uploads dir accessible
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Switch to non-root user
USER nextjs
EXPOSE 3000
ENV PORT=3000

# Execute server
CMD ["node", "apps/exhibitor/server.js"]