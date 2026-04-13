# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ patches/
COPY packages/web/package.json packages/web/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/dashboard/package.json packages/dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules

# Copy source code
COPY . .

# Build web (output: packages/web/dist) then server (output: packages/server/dist)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# ── Stage 3: Production ─────────────────────────────────────────────────────
FROM node:22-slim AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests for pnpm to resolve workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ patches/
COPY packages/web/package.json packages/web/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/dashboard/package.json packages/dashboard/

# Install production dependencies only (skip prepare/husky hooks)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts
# Server expects web dist at ../web/dist relative to server dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/packages/shared/src ./packages/shared/src

# Create data directory for SQLite
RUN mkdir -p /app/packages/server/.data

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["pnpm", "start"]
