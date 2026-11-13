# syntax=docker/dockerfile:1
# Một Dockerfile cho cả hệ thống, build từ thư mục gốc repo:
#   web    : trang web và API (Next.js standalone), image gọn để chạy
#   tools  : đủ thư viện để chạy migration, seed và worker
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
# Chỉ cài thư viện cho web, worker và database, không cài phần app điện thoại.
RUN pnpm install --frozen-lockfile \
  --filter "@dms/web..." --filter "@dms/worker..." --filter "@dms/db..."
ARG APP_VERSION=dev
ENV NEXT_TELEMETRY_DISABLED=1 APP_VERSION=${APP_VERSION}
# Giá trị tạm chỉ có trong lệnh build, không nằm lại trong image. Biến thật lấy từ file .env trên máy chủ.
RUN AUTH_SECRET=build-only DATABASE_URL=postgresql://build:build@localhost:5432/build \
  pnpm --filter @dms/web exec next build

FROM build AS tools
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@dms/db", "exec", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS web
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0 \
  APP_VERSION=${APP_VERSION}
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
