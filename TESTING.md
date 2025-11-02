# Testing Guide

This document provides an overview of the testing infrastructure for the Qiskit Code Assistant JupyterLab extension.

## Overview

The project uses Jest as the testing framework with TypeScript support. The test suite includes comprehensive unit tests covering:

- API service functions
- Autocomplete functionality (both standard and streaming)
- Completion providers (QiskitCompletionProvider and QiskitInlineCompletionProvider)
- Utility functions (request handlers)

## Test Coverage

Current test coverage (60 tests):

| File Category        | Statement Coverage | Branch Coverage | Function Coverage |
| -------------------- | ------------------ | --------------- | ----------------- |
| Overall              | 67.88%             | 37.01%          | 58.24%            |
| API Service          | 86.86%             | 80.76%          | 100%              |
| Autocomplete         | 100%               | 86.11%          | 100%              |
| Completion Providers | 89.28%             | 65.38%          | 100%              |
| Utility Handlers     | 100%               | 100%            | 100%              |

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

The project includes mocks for JupyterLab components in `src/__mocks__/@jupyterlab/`:

```typescript
jest.mock('../../utils/handler');

const mockFunction = handler.requestAPI as jest.MockedFunction<
  typeof handler.requestAPI
>;

mockFunction.mockResolvedValue(mockResponse);
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

- Tests for all API endpoints
- Request/response handling
- Error handling
- Streaming responses

### Autocomplete Tests (`src/service/__tests__/autocomplete.test.ts`)

- Standard autocomplete functionality
- Streaming autocomplete
- Token validation
- Disclaimer handling
- Input truncation

### Completion Provider Tests (`src/__tests__/QiskitCompletionProvider.test.ts`)

- QiskitCompletionProvider
- QiskitInlineCompletionProvider
- Fetch operations
- Acceptance tracking
- Streaming support

### Utility Tests (`src/utils/__tests__/handler.test.ts`)

- Request API wrapper
- Streaming request handler
- Error handling
- URL construction

## Continuous Integration

### GitHub Actions

This project includes automated testing via GitHub Actions:

#### Test Workflow

The **[Tests workflow](.github/workflows/test.yml)** runs on every push and pull request:

- ✅ Runs tests on multiple platforms (Ubuntu, macOS, Windows)
- ✅ Tests against Node.js 18.x and 20.x
- ✅ Generates coverage reports
- ✅ Provides coverage artifacts for download (viewable in Actions tab)

**Trigger:** Automatically runs on:

- Push to `main` branch
- Pull requests to any branch

**Status:** Check the ![Tests](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/workflows/Tests/badge.svg) badge

#### Build Workflow

The **[Build workflow](.github/workflows/build.yml)** includes:

- Linting checks
- Test execution with coverage
- Extension building and packaging
- Link checking

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

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Library](https://testing-library.com/)
