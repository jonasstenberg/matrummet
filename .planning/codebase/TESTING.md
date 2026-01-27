# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- Vitest (v4.0.15+)
- Configuration per workspace: `apps/frontend/vitest.config.ts`, `apps/email-service/vitest.config.ts`
- Global test APIs enabled (no import of describe/it required, but imported explicitly)

**Assertion Library:**
- Vitest built-in assertions: `expect()`
- Testing Library for React components: `@testing-library/react`
- Jest-DOM matchers: `@testing-library/jest-dom` (imported in setup files)

**Run Commands:**
```bash
pnpm test                    # Run all tests in monorepo
pnpm test:api                # Run API integration tests with seed data
```

**Per-app configuration:**
```bash
# Frontend (Next.js)
vitest run --config apps/frontend/vitest.config.ts

# Email service
vitest run --config apps/email-service/vitest.config.ts
```

## Test File Organization

**Location:**
- Co-located in `__tests__` directories next to source
- Frontend: `components/__tests__/`, `lib/__tests__/`, `lib/recipe-import/__tests__/`, `app/api/**/__tests__/`
- Email service: `src/__tests__/`

**Naming:**
- `*.test.ts` for TypeScript tests
- `*.test.tsx` for React component tests
- One test file per source module: `utils.ts` has `__tests__/utils.test.ts`

**Structure:**
```
apps/frontend/
├── components/
│   ├── instruction-editor.tsx
│   └── __tests__/
│       └── instruction-editor.test.tsx
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── utils.test.ts
└── app/
    └── api/
        └── ai/
            ├── generate/
            │   ├── route.ts
            │   └── route.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('FunctionName', () => {
  describe('when condition', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'value'
      // Act
      const result = myFunction(input)
      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

**Patterns:**
- Top-level `describe()` for module/component name
- Nested `describe()` for grouping related tests (by feature, condition, or method)
- One assertion per `it()` in most cases; multiple related assertions OK
- Clear test names starting with "should": `should merge class names`, `should return null for null input`

**Setup and Teardown:**
- `beforeEach()`: Reset mocks, initialize test data
  ```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createTestDbPool();
    mockLogger = createTestLogger();
  });
  ```
- `afterEach()`: Cleanup via Vitest's automatic restoration or explicit cleanup
- No global state pollution between tests

**Shared Setup Files:**
- `apps/frontend/vitest.config.ts`: Includes `setupFiles: ["@recept/testing/setup/jsdom"]`
- `apps/email-service/vitest.config.ts`: Includes `setupFiles: ["./src/__tests__/setup.ts"]`
- `packages/testing/src/setup/jsdom.ts`: DOM mocks, ResizeObserver, IntersectionObserver, window.matchMedia
- `packages/testing/src/setup/node.ts`: Console spying, mock clearing

## Mocking

**Framework:** Vitest `vi` module for all mocking

**Module Mocking:**
```typescript
vi.mock('../config.js', () => ({
  config: {
    app: {
      baseUrl: 'https://app.test.com',
    },
  },
  EMAIL_BATCH_SIZE: 10,
}));

vi.mock('../template.js', () => ({
  renderTemplate: vi.fn((template: string, vars: Record<string, unknown>) => {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{{${key}}}`, String(value));
    }
    return result;
  }),
}));
```

**Function Mocking:**
```typescript
const mockSendEmail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
const mockPool = {
  query: vi.fn().mockResolvedValueOnce({ rows: [template] })
};
```

**Spying:**
```typescript
vi.spyOn(console, 'log').mockImplementation(() => {});
```

**Assertions on Mocks:**
```typescript
expect(mockPool.query).toHaveBeenCalledWith(
  expect.stringContaining("SELECT * FROM email_templates"),
  ["tmpl-1"]
);
expect(onChange).toHaveBeenCalledTimes(1);
expect(mockSendEmail).toHaveBeenCalled();
```

**What to Mock:**
- External dependencies: database pools, HTTP clients, SMTP
- Date/time: when precise timing matters (rarely done, tests often accept current time)
- Configuration: environment-specific values loaded from config files
- Functions with side effects: file I/O, network calls, logging

**What NOT to Mock:**
- Pure utility functions: `cn()`, `getImageUrl()` tested directly
- Core business logic: Recipe operations, ingredient parsing (test the real logic)
- DOM APIs are already mocked globally in jsdom setup
- TypeScript types and interfaces (they don't exist at runtime)

## Fixtures and Factories

**Test Data:**
```typescript
function createTestDbPool() {
  const query = vi.fn();
  return { query };
}

function createTestLogger() {
  const info = vi.fn();
  return { info };
}

function createTestSendEmailFn() {
  return vi.fn().mockResolvedValue({ messageId: 'test-id' });
}

// Usage in beforeEach
beforeEach(() => {
  mockPool = createTestDbPool();
  mockLogger = createTestLogger();
  mockSendEmail = createTestSendEmailFn();
});
```

**Inline Test Data:**
```typescript
const instructions = [
  { step: 'Step 1', group_id: 'group-1' },
  { step: 'Step 2', group_id: 'group-2' },
];

const groups = [
  { id: 'group-1', name: 'Grupp 1' },
  { id: 'group-2', name: 'Grupp 2' },
];
```

**Location:**
- Factory functions defined at top of test file, before describe block
- Inline test data created within `it()` blocks for specificity
- No shared fixtures in separate files (not observed in this codebase)

## Coverage

**Requirements:** No coverage targets enforced or detected (no coverage config)

**View Coverage:**
```bash
vitest run --coverage          # If coverage plugin installed
```

**Current State:** Tests exist for:
- Utility functions (`lib/__tests__/utils.test.ts`, `lib/__tests__/auth.test.ts`)
- React components (`components/__tests__/instruction-editor.test.tsx`, `components/__tests__/search-bar.test.tsx`)
- API routes (`app/api/**/*.test.ts`)
- Backend modules (`src/__tests__/*.test.ts` in email-service)

**Gaps:** Some untested areas exist but no systematic coverage report visible.

## Test Types

**Unit Tests:**
- Pure functions: `cn()`, `getImageUrl()`, `getImageSrcSet()` in `lib/__tests__/utils.test.ts`
- Utility functions: Schema parsing, recipe parsing in `lib/__tests__/`
- Test scope: Single function, mocked dependencies
- Approach: Arrange-Act-Assert pattern with multiple assertions per function

**Example Unit Test:**
```typescript
describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge Tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
```

**Integration Tests:**
- Component rendering: `InstructionEditor` component with full interaction
- Database operations: `queue.test.ts` tests database mutations through mocked pool
- Test scope: Multiple functions/components working together, some mocks for external systems
- Approach: Setup data, render/invoke, verify behavior and side effects

**Example Integration Test:**
```typescript
it('moves group up correctly (swaps with previous group)', () => {
  const instructions = [
    { step: 'Step A1', group_id: 'group-a' },
    { step: 'Step B1', group_id: 'group-b' },
  ];
  const groups = [
    { id: 'group-a', name: 'Group A' },
    { id: 'group-b', name: 'Group B' },
  ];
  const onChange = vi.fn();

  render(
    <InstructionEditor instructions={instructions} groups={groups} onChange={onChange} />
  );

  const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' });
  fireEvent.click(upButtons[1]);

  expect(onChange).toHaveBeenCalledTimes(1);
  const [newInstructions] = onChange.mock.calls[0];
  expect(newInstructions[0].group_id).toBe('group-b');
});
```

**E2E Tests:**
- Not observed in unit/integration test suite
- API integration tests exist: `tests/api/` with seed data
- Approach: Run against real database, real PostgREST API

**API Integration Test Command:**
```bash
pnpm test:api    # Runs with Docker test environment (PG 5433, PostgREST 4445)
```

## Common Patterns

**Async Testing:**
```typescript
it('should fetch and lock queued messages', async () => {
  mockPool.query.mockResolvedValueOnce({ rows: messages });

  const result = await fetchQueuedTransactionalMessages(mockPool, 5);

  expect(result).toEqual(messages);
});

// With rejection
it('should throw when template not found', async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [] });

  await expect(
    processTransactionalEmail(mockPool, mockSendEmail, message, mockLogger)
  ).rejects.toThrow('Template not found: nonexistent');
});
```

**Error Testing:**
```typescript
it('should return null for null input', () => {
  expect(getImageUrl(null)).toBeNull();
});

it('should return error object on failure', () => {
  const result = downloadImage('invalid');
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
});
```

**React Component Testing:**
```typescript
import { render, screen, fireEvent, within } from '@testing-library/react';

it('disables both move buttons when there is only one group', () => {
  const instructions = [{ step: 'Step 1', group_id: 'group-1' }];
  const groups = [{ id: 'group-1', name: 'Grupp 1' }];
  const onChange = vi.fn();

  render(
    <InstructionEditor instructions={instructions} groups={groups} onChange={onChange} />
  );

  const upButton = screen.getByRole('button', { name: 'Flytta grupp upp' });
  const downButton = screen.getByRole('button', { name: 'Flytta grupp ner' });

  expect(upButton).toBeDisabled();
  expect(downButton).toBeDisabled();
});
```

**Boundary Testing:**
```typescript
describe('edge cases', () => {
  it('does nothing when moving up on first group (boundary check)', () => {
    const instructions = [
      { step: 'Step A1', group_id: 'group-a' },
      { step: 'Step B1', group_id: 'group-b' },
    ];
    const onChange = vi.fn();

    render(<InstructionEditor instructions={instructions} onChange={onChange} />);

    const upButtons = screen.getAllByRole('button', { name: 'Flytta grupp upp' });
    fireEvent.click(upButtons[0]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Mock Verification:**
```typescript
// Verify exact calls
expect(mockPool.query).toHaveBeenCalledWith(
  expect.stringContaining("UPDATE email_messages SET status = 'sent'"),
  ["msg-123"]
);

// Verify was called
expect(mockSendEmail).toHaveBeenCalled();

// Verify call count
expect(onChange).toHaveBeenCalledTimes(1);
```

---

*Testing analysis: 2026-01-27*
