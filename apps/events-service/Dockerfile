FROM oven/bun:1

WORKDIR /app

# Copy pnpm-lock.yaml for better dependency resolution
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for workspace packages
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared/package.json ./packages/shared/
COPY apps/events-service/package.json ./apps/events-service/

# Install pnpm and dependencies
RUN bun install -g pnpm && pnpm install --frozen-lockfile

# Copy source files
COPY packages/tsconfig ./packages/tsconfig
COPY packages/shared ./packages/shared
COPY apps/events-service ./apps/events-service

# Build shared package (still needed — exports from dist/)
RUN cd packages/shared && pnpm build

# Set working directory to the events service
WORKDIR /app/apps/events-service

EXPOSE 4005

CMD ["bun", "src/index.ts"]
