# @recept/shared

Shared utilities for recept Node.js services.

## Installation

This package is available as a workspace dependency:

```json
{
  "dependencies": {
    "@recept/shared": "workspace:*"
  }
}
```

## Features

### Configuration

Utilities for loading configuration from environment variables:

```typescript
import { loadBaseConfig, loadDbConfig, getRequiredEnv, getOptionalEnv } from '@recept/shared';

const baseConfig = loadBaseConfig();

const dbConfig = loadDbConfig();

const apiKey = getRequiredEnv('API_KEY');

const port = getOptionalEnv('PORT', '3000');
```

### JWT

JWT generation and verification utilities:

```typescript
import { generateToken, verifyToken, generateServiceToken } from '@recept/shared';

const token = generateToken({ role: 'user', userId: 123 });

const payload = verifyToken(token);

const serviceToken = generateServiceToken('email-service');
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in watch mode during development
pnpm dev

# Lint code
pnpm lint

# Format code
pnpm format
```
