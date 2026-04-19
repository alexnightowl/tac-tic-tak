FROM node:20-alpine AS base
RUN apk add --no-cache zstd openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --filter backend --frozen-lockfile || pnpm install --filter backend

FROM base AS build
COPY --from=deps /app /app
COPY apps/backend apps/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend run build

FROM base AS runtime
ENV NODE_ENV=production
# Take node_modules from the build stage so the generated Prisma client is present.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/apps/backend/prisma /app/apps/backend/prisma
COPY --from=build /app/apps/backend/package.json /app/apps/backend/package.json
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
