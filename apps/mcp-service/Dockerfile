# NOTE: Production does NOT use Docker — the VPS runs this via systemd
# (`bun src/index.ts`, see infra/systemd/matrummet-mcp.service). This Dockerfile
# exists only for local/container parity and is not part of the deploy pipeline.
FROM oven/bun:1

WORKDIR /app

# Copy lockfile + workspace manifest for dependency resolution
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for workspace packages this service builds against
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/mcp-service/package.json ./apps/mcp-service/

# Install pnpm and dependencies
RUN bun install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY packages/tsconfig ./packages/tsconfig
COPY apps/mcp-service ./apps/mcp-service

WORKDIR /app/apps/mcp-service

# SQLite store lives here unless SQLITE_PATH overrides it
RUN mkdir -p data

EXPOSE 4008

CMD ["bun", "src/index.ts"]
