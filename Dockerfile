# syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# unraid-mcp — MCP server for the Unraid GraphQL API.
#
# Multi-stage build:
#   builder  — install the full pnpm workspace (applies the committed
#              @modelcontextprotocol/sdk patch), build with tsc, then `pnpm deploy`
#              the mcp package into a self-contained prod tree (resolves the
#              workspace:* SDK dependency and prunes devDependencies).
#   runtime  — node:24-slim, non-root, runs the HTTP transport on :3000.
#
# Default posture is the HTTP transport for container/Unraid-App use. The
# recommended first-run safety setting is MCP_READ_ONLY=true (documented, not
# baked, so writes can be enabled deliberately).
# ------------------------------------------------------------------------------

FROM node:24-slim AS builder
WORKDIR /src

# Pin pnpm via corepack to match packageManager in package.json.
RUN corepack enable

# Install with the lockfile first for better layer caching. The workspace
# manifests + lockfile + the pnpm patch are all needed for a faithful install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches/ ./patches/
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/mcp/package.json packages/mcp/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/unraid-toolkit/package.json packages/unraid-toolkit/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Bring in sources and build the TypeScript project references.
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ ./packages/
RUN pnpm build

# Produce a self-contained production tree for the mcp package. `deploy` copies
# the built `dist` (per the package's `files`) and resolves workspace:* deps.
# `--legacy` is required because the workspace does not set
# inject-workspace-packages (pnpm v10 otherwise refuses to deploy).
RUN pnpm --filter @unraid-toolkit/mcp --legacy deploy --prod /app

# ------------------------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_PORT=3000

# Run as the unprivileged `node` user that the base image already provides.
COPY --from=builder --chown=node:node /app ./
# Ship the license with the image (compliance / downstream redistribution).
COPY --chown=node:node LICENSE ./LICENSE
USER node

EXPOSE 3000

# Liveness probe hits the HTTP transport's /healthz route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_HTTP_PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "dist/index.js"]
