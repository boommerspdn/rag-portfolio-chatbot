FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY apps/api apps/api

RUN pnpm --filter api build
RUN pnpm --filter api --prod deploy --legacy /app/deploy/api
RUN cd /app/deploy/api && pnpm exec prisma generate
RUN rm -rf /app/deploy/api/dist && cp -r /app/apps/api/dist /app/deploy/api/dist

FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/deploy/api ./

EXPOSE 3000

 CMD ["node", "dist/src/main"]
