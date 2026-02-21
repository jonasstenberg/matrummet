FROM oven/bun:1
WORKDIR /app

COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for workspace packages
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared/package.json ./packages/shared/
COPY apps/image-service/package.json ./apps/image-service/

RUN bun install -g pnpm && pnpm install --frozen-lockfile

COPY packages/tsconfig ./packages/tsconfig
COPY packages/shared ./packages/shared
COPY apps/image-service ./apps/image-service

# Build shared package (exports from dist/)
RUN cd packages/shared && pnpm build

WORKDIR /app/apps/image-service
EXPOSE 4006
CMD ["bun", "src/index.ts"]
