ARG BASE_IMAGE=docker.arvancloud.ir/node:22-alpine
FROM ${BASE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.8 prune @repo/exhibitor --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --fetch-timeout 600000
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@repo/exhibitor

FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/.next/static ./apps/exhibitor/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/exhibitor/public ./apps/exhibitor/public
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
USER nextjs
EXPOSE 3000
CMD ["node", "apps/exhibitor/server.js"]
