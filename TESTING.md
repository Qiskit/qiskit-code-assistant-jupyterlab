# Testing Guide

This document provides an overview of the testing infrastructure for the Qiskit Code Assistant JupyterLab extension.

## Overview

The project uses Jest as the testing framework with TypeScript support. The test suite includes comprehensive unit tests covering:

- API service functions
- Autocomplete functionality (both standard and streaming)
- Completion providers (QiskitCompletionProvider and QiskitInlineCompletionProvider)
- Utility functions (request handlers)
- Model and token management
- Credential management (multiple IBM Quantum accounts)
- Status bar widget

## Test Coverage

Current test coverage (142 tests across 8 test suites):

| File Category        | Statement Coverage | Branch Coverage | Function Coverage |
| -------------------- | ------------------ | --------------- | ----------------- |
| Overall              | 81.38%             | 61.65%          | 80.99%            |
| API Service          | 88.27%             | 76.27%          | 100%              |
| Autocomplete         | 93.33%             | 81.25%          | 100%              |
| Completion Providers | 74.85%             | 51.68%          | 65.38%            |
| Credentials          | 91.42%             | 91.07%          | 100%              |
| Utility Handlers     | 97.56%             | 93.75%          | 100%              |
| Model Handler        | 100%               | 86.36%          | 100%              |
| Token Service        | 100%               | 100%            | 100%              |
| Status Bar Widget    | 100%               | 83.33%          | 100%              |

## Running Tests

### Run all tests

```bash
npm test
# or
jlpm test
```

### Run tests in watch mode

Useful during development - automatically reruns tests when files change:

```bash
npm run test:watch
# or
jlpm test:watch
```

### Run tests with coverage report

Generates detailed coverage reports in the `coverage/` directory:

```bash
npm run test:coverage
# or
jlpm test:coverage
```

After running, open `coverage/lcov-report/index.html` in your browser to view the detailed coverage report.

## Test Structure

Tests are organized using the following patterns:

1. **`__tests__` directories**: Tests in directories adjacent to the source code
   - Example: `src/service/__tests__/api.test.ts` tests `src/service/api.ts`

2. **`.test.ts` suffix**: Test files with the `.test.ts` or `.test.tsx` extension
   - Example: `handler.test.ts`

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('MyComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Mocking Dependencies

The project includes comprehensive mocks for JupyterLab and Lumino components in `src/__mocks__/`:

**Available mocks:**

- `@jupyterlab/application` - JupyterFrontEnd, plugins
- `@jupyterlab/apputils` - Dialogs, notifications
- `@jupyterlab/completer` - Completion providers and contexts
- `@jupyterlab/coreutils` - URL utilities
- `@jupyterlab/notebook` - NotebookPanel
- `@jupyterlab/services` - ServerConnection
- `@jupyterlab/settingregistry` - Settings management
- `@jupyterlab/statusbar` - Status bar components
- `@jupyterlab/ui-components` - Icons (LabIcon, refreshIcon)
- `@lumino/widgets` - Widget base class with addClass/removeClass/hasClass
- `svgMock.ts` - SVG file imports

**Example usage:**

```typescript
jest.mock('../../utils/handler');

const mockFunction = handler.requestAPI as jest.MockedFunction<
  typeof handler.requestAPI
>;

mockFunction.mockResolvedValue(mockResponse);
```

**Mocking dialogs:**

```typescript
jest.mock('@jupyterlab/apputils', () => ({
  InputDialog: {
    getPassword: jest.fn(),
    getItem: jest.fn()
  }
}));
```

### Testing Async Generators

For streaming functionality:

```typescript
async function* mockGenerator() {
  yield { data: 'chunk1' };
  yield { data: 'chunk2' };
}

const results = [];
for await (const chunk of streamingFunction()) {
  results.push(chunk);
}

expect(results).toHaveLength(2);
```

## Test Configuration

### Files

- **`jest.config.js`**: Main Jest configuration
- **`tsconfig.test.json`**: TypeScript configuration for tests
- **`src/__tests__/setup.ts`**: Global test setup (runs before all tests)
- **`src/__mocks__/`**: Mock implementations for external dependencies

### Key Configuration Options

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/examples/**',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ]
}
```

## Test Categories

### API Service Tests (`src/service/__tests__/api.test.ts`)

Tests for all API endpoints including:

- GET/POST request handling
- Model and disclaimer endpoints
- Streaming responses with SSE parsing
- Error handling and authentication
- Feedback submission

### Autocomplete Tests (`src/service/__tests__/autocomplete.test.ts`)

Tests for code completion functionality:

- Standard autocomplete functionality
- Streaming autocomplete with AbortSignal
- Token validation
- Disclaimer handling
- Input truncation (CHAR_LIMIT)
- Error recovery

### Completion Provider Tests (`src/__tests__/QiskitCompletionProvider.test.ts`)

Tests for JupyterLab completion providers:

- QiskitCompletionProvider (standard completer)
- QiskitInlineCompletionProvider (inline completer)
- Fetch operations and streaming
- Acceptance tracking and prompt management
- Stream cancellation and timeout handling
- Context extraction from notebooks

### Utility Tests (`src/utils/__tests__/handler.test.ts`)

Tests for API request utilities:

- Request API wrapper
- Streaming request handler with ReadableStream
- Error handling
- URL construction
- UTF-8 decoding

### Model Handler Tests (`src/service/__tests__/modelHandler.test.ts`)

Tests for model management:

- Getting and setting current model
- Refreshing models list
- Model persistence across refreshes
- Status bar integration

### Token Service Tests (`src/service/__tests__/token.test.ts`)

Tests for API token management:

- Token validation and checking
- Token update workflow with manual entry
- Multiple credentials detection and routing
- Dialog interactions
- Model list refresh on token update
- Error handling for invalid tokens

### Credentials Service Tests (`src/service/__tests__/credentials.test.ts`)

Tests for multi-credential management:

- Proactive credential selection prompts
- Environment variable detection
- Multiple credential handling
- Single credential auto-selection
- Credential selection dialog workflow
- "Don't Ask Again" preference handling
- Credential clearing and resetting
- Error handling for API failures

### Status Bar Widget Tests (`src/__tests__/StatusBarWidget.test.ts`)

Tests for the status bar UI component:

- Widget construction and DOM creation
- Status bar refresh with model info
- Loading status indicators (single and concurrent requests)
- Request counter management
- Click handler and model selection
- Event listener lifecycle (attach/detach)

## Continuous Integration

### GitHub Actions

This project includes automated testing via GitHub Actions:

#### Build Workflow

The **[Build workflow](.github/workflows/build.yml)** runs on every push and pull request and includes:

- ✅ Linting checks (stylelint, prettier, eslint)
- ✅ Test execution with coverage
- ✅ Coverage report artifacts (downloadable from Actions tab)
- ✅ Extension building and packaging
- ✅ Isolated installation testing
- ✅ Link checking

**Trigger:** Automatically runs on:

- Push to `main` branch
- Pull requests to any branch

**Status:** Check the ![Build](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/workflows/Build/badge.svg) badge

### Running Tests Locally Like CI

To replicate the CI environment locally:

```bash
# Run the same commands as CI
npm install
npm test
npm run test:coverage
```

### Coverage Reporting

Coverage reports are automatically:

- Generated on every test run in CI
- Available as artifacts in the Actions tab (for 7 days)

**To view coverage locally:**

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

**To download coverage from CI:**

1. Go to the Actions tab
2. Click on a workflow run
3. Scroll to "Artifacts"
4. Download "coverage-report"

## Debugging Tests

### Run a specific test file

```bash
npm test -- src/service/__tests__/api.test.ts
```

### Run tests matching a pattern

```bash
npm test -- --testNamePattern="should handle errors"
```

### Run with verbose output

```bash
npm test -- --verbose
```

## Common Issues

### Import Errors

If you encounter module resolution errors, ensure:

- Mock files exist in `src/__mocks__/@jupyterlab/`
- `jest.config.js` includes proper module mappings

### TypeScript Errors

- Tests use relaxed TypeScript configuration (`tsconfig.test.json`)
- Use `as any` for complex mock type casting when needed

### Async Test Timeouts

Increase timeout for long-running tests:

```typescript
it('long test', async () => {
  // test code
}, 10000); // 10 second timeout
```

## Best Practices

1. **Clear mocks between tests**: Use `beforeEach(() => jest.clearAllMocks())`
2. **Test both success and error cases**: Cover happy path and error scenarios
3. **Mock external dependencies**: Don't make real API calls in tests
4. **Keep tests focused**: One assertion per test when possible
5. **Use descriptive test names**: Clearly indicate what is being tested
6. **Maintain high coverage**: Aim for >80% coverage on critical paths

## Mock Infrastructure

### Custom Mocks Overview

The project includes custom mock implementations for JupyterLab and Lumino libraries to enable testing without full dependency installation. These mocks are automatically used by Jest through the module name resolution.

#### Lumino Widget Mock

The `@lumino/widgets` mock provides a basic Widget implementation with:

```typescript
export class Widget {
  node: HTMLElement;
  addClass(className: string): void;
  removeClass(className: string): void;
  hasClass(className: string): boolean;
  protected onAfterAttach(msg: any): void;
  protected onBeforeDetach(msg: any): void;
}
```

This allows testing components that extend Widget without requiring the full Lumino library.

#### JupyterLab UI Components Mock

The `@jupyterlab/ui-components` mock provides LabIcon class and common icons:

```typescript
export class LabIcon {
  name: string;
  svgstr: string;
  constructor(options: { name: string; svgstr: string });
}

export const refreshIcon = new LabIcon({
  name: 'ui-components:refresh',
  svgstr: '<svg>refresh</svg>'
});
```

#### ReadableStream Mocks

When testing streaming functionality, ensure your ReadableStream reader mocks include the `releaseLock` method:

```typescript
const mockReader = {
  read: jest
    .fn()
    .mockResolvedValueOnce({ done: false, value: chunk1 })
    .mockResolvedValueOnce({ done: true, value: undefined }),
  releaseLock: jest.fn()
};
```

### Adding New Mocks

When adding tests that require new external dependencies:

1. Create a mock file in `src/__mocks__/@<package-name>/`
2. Export the minimal interface needed for your tests
3. Use TypeScript interfaces for type safety
4. Document the mock in this section

Example:

```typescript
// src/__mocks__/@jupyterlab/newpackage.ts
export class NewComponent {
  // Minimal implementation
}
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Library](https://testing-library.com/)
- [JupyterLab Extension Development Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
