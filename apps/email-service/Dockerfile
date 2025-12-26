FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate

# Copy pnpm-lock.yaml for better dependency resolution
COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for workspace packages
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared/package.json ./packages/shared/
COPY apps/email-service/package.json ./apps/email-service/

# Install all dependencies at the workspace level to ensure TypeScript is available
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/tsconfig ./packages/tsconfig
COPY packages/shared ./packages/shared
COPY apps/email-service ./apps/email-service

# Build shared package first
RUN cd packages/shared && pnpm build

# Build the application
RUN cd apps/email-service && pnpm build

# Set working directory to the email service
WORKDIR /app/apps/email-service

# Expose the port the app runs on
EXPOSE 4004

# Start the application
CMD ["pnpm", "start"]
