FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --filter frontend --frozen-lockfile || pnpm install --filter frontend

FROM base AS build
COPY --from=deps /app /app
COPY apps/frontend apps/frontend
# Bake the public API URL into the Next.js bundle. Defaults to same-origin `/api`.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter frontend run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
