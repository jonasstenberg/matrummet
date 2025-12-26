# @recept/tsconfig

Shared TypeScript configurations for recept projects.

## Usage

In your TypeScript project, install the package:

```bash
pnpm add -D @recept/tsconfig
```

Then extend the appropriate configuration in your `tsconfig.json`:

### For Node.js services:

```json
{
  "extends": "@recept/tsconfig/node.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### For web applications:

```json
{
  "extends": "@recept/tsconfig/web.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Available Configurations

- `base.json`: Base configuration shared by all project types
- `node.json`: Configuration for Node.js services
- `web.json`: Configuration for React web applications
