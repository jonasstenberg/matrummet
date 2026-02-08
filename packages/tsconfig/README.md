# @matrummet/tsconfig

Shared TypeScript configurations for matrummet projects.

## Usage

In your TypeScript project, install the package:

```bash
pnpm add -D @matrummet/tsconfig
```

Then extend the appropriate configuration in your `tsconfig.json`:

### For Node.js services:

```json
{
  "extends": "@matrummet/tsconfig/node.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### For web applications:

```json
{
  "extends": "@matrummet/tsconfig/web.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Available Configurations

- `base.json`: Base configuration shared by all project types
- `node.json`: Configuration for Node.js services
- `web.json`: Configuration for React web applications
