# AGENTS.md

This file provides guidance to AI development assistants when working with code in this repository.

**Supported AI Assistants:**
- IBM Bob
- Claude Code
- GitHub Copilot
- Cursor AI
- Windsurf
- Gemini CLI
- Any AI assistant with codebase context awareness

## Project Overview

qiskit-code-assistant-jupyterlab is a JupyterLab extension that provides AI-powered code completion for quantum computing development using Qiskit. It integrates with LLM APIs (IBM Quantum Cloud or OpenAI-compatible endpoints) to provide intelligent, context-aware code suggestions for Python quantum programs.

### Core Purpose
- Accelerate Qiskit code development with AI-powered completions
- Help developers learn Qiskit best practices through suggestions
- Support migration from old Qiskit to v2.x
- Provide real-time streaming code generation
- Work both with cloud (IBM Quantum) and local (Ollama) deployments

### Key Technologies
- **Extension Platform**: JupyterLab Extension API (v4.3.0+)
- **Language**: TypeScript (strict mode)
- **Backend**: Python server extension
- **LLM Integration**: IBM Quantum Cloud API, OpenAI-compatible APIs
- **Model**: `mistral-small-3.2-24b-qiskit` (cloud) or local models via Ollama
- **Streaming**: Server-Sent Events (SSE) with circuit breaker pattern
- **Testing**: Jest for frontend, pytest for backend

## Architecture

### Component Structure
1. **Extension Entry Point** ([src/index.ts](src/index.ts)):
   - Main plugin initialization
   - Registers completion provider and status bar widget
   - Manages settings and credentials

2. **Completion Provider** ([src/QiskitCompletionProvider.ts](src/QiskitCompletionProvider.ts)):
   - Implements JupyterLab's inline completion interface
   - Handles code context extraction
   - Manages suggestion lifecycle

3. **Status Bar Widget** ([src/StatusBarWidget.ts](src/StatusBarWidget.ts)):
   - Displays model status and credentials
   - Provides user interaction for token/model selection
   - Shows telemetry status

4. **Services** ([src/service/](src/service/)):
   - `api.ts`: Unified API layer and routing
   - `autocomplete.ts`: Code completion service
   - `migration.ts`: Migration-specific service
   - `credentials.ts`: Credential management
   - `token.ts`: API token handling
   - `modelHandler.ts`: Model selection logic

5. **Utilities** ([src/utils/](src/utils/)):
   - `handler.ts`: HTTP request handling and streaming
   - `icons.ts`: UI icon definitions
   - `schema.ts`: Schema type definitions

6. **Python Backend** ([qiskit_code_assistant_jupyterlab/](qiskit_code_assistant_jupyterlab/)):
   - Server extension for backend API
   - Handles server-side processing

### Data Flow
```
User Types Code → JupyterLab Inline Completion Trigger
                           ↓
                  QiskitCompletionProvider
                           ↓
                  Service API (routing)
                           ↓
              autocomplete.ts OR migration.ts
                           ↓
              handler.ts (SSE streaming)
                           ↓
              Inline Suggestion Display
                           ↓
         User Accepts (Tab) or Rejects (Esc)
```

## Key Components

### Configuration Settings
All extension settings are in schema/plugin.json:
- `apiUrl`: API endpoint (default: https://qiskit-code-assistant.quantum.ibm.com)
- `apiToken`: API authentication token
- `selectedCredential`: Selected credential from ~/.qiskit/qiskit-ibm.json
- `selectedModel`: Selected LLM model
- `enableTelemetry`: Opt-in telemetry (default: true)
- `enableStreaming`: Real-time streaming (default: true)
- `streamingDebounceMs`: Debounce delay in milliseconds (default: 500)
- `maxTokens`: Maximum tokens in response (default: 1000)

### Core Files and Directories
- `src/index.ts`: Main extension entry point
- `src/QiskitCompletionProvider.ts`: Completion provider implementation
- `src/StatusBarWidget.ts`: Status bar UI
- `src/service/`: API service layer
- `src/utils/`: Core utilities (HTTP, icons, schema)
- `src/__tests__/`: Frontend test suite
- `qiskit_code_assistant_jupyterlab/`: Python backend
- `package.json`: NPM package manifest
- `pyproject.toml`: Python package configuration
- `schema/`: Settings schema definitions
- `docs/`: User and developer documentation

## Development Guidelines

### Environment Setup

1. **Prerequisites**:
   - JupyterLab 4.3.0+
   - Node.js v18+
   - Python 3.8+
   - Git

2. **Installation**:
   ```bash
   # Clone the repository
   git clone https://github.com/Qiskit/qiskit-code-assistant-jupyterlab.git
   cd qiskit-code-assistant-jupyterlab

   # Install package in development mode
   pip install -e "."

   # Link your development version of the extension with JupyterLab
   jupyter labextension develop . --overwrite

   # Enable server extension
   jupyter server extension enable qiskit_code_assistant_jupyterlab

   # Install JavaScript dependencies and build
   jlpm install
   jlpm build
   ```

3. **Running from Source**:
   ```bash
   # Watch for changes in one terminal
   jlpm watch

   # Run JupyterLab in another terminal
   jupyter lab
   ```
   - Refresh JupyterLab to see changes
   - May need to wait several seconds for extension rebuild

4. **Building for Production**:
   ```bash
   # Build production version
   jlpm build:prod

   # This creates optimized build in lib/
   ```

### Code Conventions

1. **TypeScript Standards**:
   - Strict mode enabled
   - Prefer `async/await` over promises
   - Use typed errors with try/catch
   - Naming: camelCase for functions, PascalCase for classes and interfaces
   - Interfaces must start with 'I' (e.g., `ISettings`)
   - Single quotes for strings

2. **JupyterLab Extension Patterns**:
   - Follow JupyterLab plugin architecture
   - Use JupyterLab's settings system
   - Implement proper widget lifecycle
   - Use JupyterLab UI components

3. **API Integration**:
   - All API calls go through `src/service/api.ts`
   - Use streaming handler for real-time responses
   - Implement proper error handling and retry logic
   - Follow existing patterns in `autocomplete.ts` or `migration.ts`

4. **Testing**:
   - Write tests in `src/__tests__/` or `src/service/__tests__/`
   - Use Jest for frontend tests
   - Mock JupyterLab API using `src/__mocks__/`
   - Run tests: `jlpm test`
   - Coverage: `jlpm test:coverage`

5. **Debugging**:
   - Check browser console in JupyterLab
   - Use Developer Tools: Settings → Advanced Settings Editor
   - Enable streaming debug mode in settings
   - Monitor status bar for real-time feedback

### Adding New Features

1. **Adding a New Service**:
   ```typescript
   // src/service/myNewService.ts
   import { requestAPI } from './api';

   export async function myServiceFunction(
     params: any
   ): Promise<any> {
     return requestAPI('my-endpoint', {
       method: 'POST',
       body: JSON.stringify(params)
     });
   }
   ```

2. **Adding New Settings**:
   - Add to `schema/plugin.json`
   - Access via `ISettingRegistry`
   - Document in README.md
   - Update TypeScript interfaces in `src/utils/schema.ts`

3. **Modifying Streaming Behavior**:
   - Core logic in `src/utils/handler.ts`
   - Read inline documentation carefully
   - Test with different network conditions
   - Ensure error handling works correctly

4. **Adding UI Components**:
   - Use JupyterLab UI components from `@jupyterlab/ui-components`
   - Follow existing patterns in `StatusBarWidget.ts`
   - Ensure proper cleanup in `dispose()` methods

## Common Tasks

### Building and Testing
```bash
# Install dependencies
jlpm install

# Build extension
jlpm build

# Build with watch mode
jlpm watch

# Run tests
jlpm test

# Run tests in watch mode
jlpm test:watch

# Run tests with coverage
jlpm test:coverage

# Lint code
jlpm lint

# Format code
jlpm prettier
```

### Debugging Workflows

1. **Debugging Extension**:
   - Open browser Developer Tools in JupyterLab
   - Check Console for errors and logs
   - Use Network tab to monitor API calls
   - Set breakpoints in TypeScript source (with source maps)

2. **Debugging Tests**:
   - Use `jlpm test:watch` for interactive testing
   - Add `console.log` in tests for debugging
   - Run specific test file: `jlpm test <filename>`

3. **Debugging Streaming Issues**:
   - Enable streaming debug in settings
   - Check browser console for detailed logs
   - Monitor Network tab for SSE events
   - Verify API endpoint connectivity

### Release Process
See [RELEASE.md](RELEASE.md) for complete release workflow.

## Documentation Structure

### User-Facing Documentation
- [README.md](README.md): Installation, setup, features
- [GETTING_STARTED.md](GETTING_STARTED.md): Getting started guide
- [LOCAL_SETUP.md](LOCAL_SETUP.md): Local deployment with Ollama
- [docs/credential_selection.md](docs/credential_selection.md): Multi-credential setup
- [docs/EULA.md](docs/EULA.md): Model license and terms

### Developer Documentation
- [CONTRIBUTING.md](CONTRIBUTING.md): Contribution guidelines
- [TESTING.md](TESTING.md): Testing guide
- [RELEASE.md](RELEASE.md): Release workflow

## Important Constraints

### What This Extension Does
- **Code completion only**: Provides inline suggestions for Python/Qiskit code
- **Multi-cell context**: Analyzes all cells before the current cell to provide context-aware suggestions
- **Python notebooks**: Works with Jupyter notebooks (`.ipynb`)
- **Streaming**: Real-time token-by-token generation
- **Code migration**: Helps migrate legacy Qiskit code to v2.x

### What This Extension Does NOT Do
- Does NOT analyze the entire notebook (only cells before the current cell)
- Does NOT execute code or quantum circuits
- Does NOT provide chat interface
- Does NOT work with non-Python languages
- Does NOT have agentic/autonomous capabilities
- Does NOT store code on servers (privacy-preserving)

### EULA Restrictions
- **Beta/Preview service**: No SLA, experimental features
- **Authorized use only**: Research, education, testing, evaluation
- **No commercial use**: Personal/educational use only
- **No proprietary code**: Don't use with proprietary code (cloud model)
- **Premium plan required**: IBM Quantum premium plan for cloud (or use local setup)

## Troubleshooting

### Common Issues

1. **No suggestions appearing**:
   - Check: Is it a Python code cell?
   - Check: Is API token set in settings or status bar?
   - Check: Status bar shows model name
   - Check: Network connectivity to API endpoint
   - Check: Browser console for errors

2. **Streaming not working**:
   - Verify: `enableStreaming` setting is `true`
   - Check: API endpoint is accessible
   - Check: Browser console for streaming errors
   - Try: Adjust `streamingDebounceMs` setting

3. **Tests failing**:
   - Ensure: Dependencies installed with `jlpm install`
   - Run: `jlpm clean && jlpm build` for clean build
   - Check: Node.js version (v18+ required)
   - Check: TypeScript version matches package.json

4. **Build errors**:
   - Clean: `jlpm clean:all` then rebuild
   - Check: Node.js version (v18+ required)
   - Update: `jlpm install` to sync dependencies
   - Verify: JupyterLab version compatibility

5. **Extension not loading**:
   - Check: Extension is linked with `jupyter labextension list`
   - Check: Server extension enabled
   - Try: `jupyter lab clean` then restart
   - Check: Browser console for loading errors

### Debug Commands

```bash
# Clear build artifacts
jlpm clean:all

# Rebuild from scratch
jlpm clean:all && jlpm install && jlpm build

# Check TypeScript types
jlpm build

# List installed extensions
jupyter labextension list

# Clean JupyterLab cache
jupyter lab clean
```

## File Structure Reference

```
qiskit-code-assistant-jupyterlab/
├── .github/
│   └── workflows/          # CI/CD automation
├── docs/
│   ├── AGENTS.md          # This file
│   ├── credential_selection.md
│   └── EULA.md
├── src/
│   ├── index.ts           # Extension entry point
│   ├── QiskitCompletionProvider.ts  # Completion provider
│   ├── StatusBarWidget.ts # Status bar widget
│   ├── service/           # API services
│   │   ├── api.ts
│   │   ├── autocomplete.ts
│   │   ├── migration.ts
│   │   ├── credentials.ts
│   │   ├── token.ts
│   │   └── modelHandler.ts
│   ├── utils/             # Utilities
│   │   ├── handler.ts
│   │   ├── icons.ts
│   │   └── schema.ts
│   ├── __tests__/         # Frontend tests
│   └── __mocks__/         # Test mocks
├── qiskit_code_assistant_jupyterlab/  # Python backend
│   ├── __init__.py
│   └── handlers.py
├── schema/
│   └── plugin.json        # Settings schema
├── package.json           # NPM package manifest
├── pyproject.toml         # Python package config
├── tsconfig.json          # TypeScript config
├── README.md              # User docs
├── CONTRIBUTING.md        # Contributor guide
├── TESTING.md             # Testing guide
├── GETTING_STARTED.md     # Getting started
├── LOCAL_SETUP.md         # Local deployment
└── setup_local.sh         # Local setup script
```

## Best Practices for AI Assistants

When helping with this repository:

1. **Always check existing code first**: Use Read tool on relevant files before suggesting changes
2. **Follow existing patterns**: Match code style and architecture from similar components
3. **Don't hallucinate features**: Only reference capabilities that actually exist in the codebase
4. **Reference correct docs**: Point users to README.md, CONTRIBUTING.md, and TESTING.md
5. **Test before suggesting**: Verify code compiles and tests pass
6. **Respect constraints**: Remember this is Python-only, single-cell context, code completion
7. **Check recent changes**: Review git history for context on recent modifications
8. **Use proper tool**: Use Grep for searching, Read for files, Edit for changes
9. **JupyterLab-specific**: Follow JupyterLab extension patterns and APIs
10. **Dual codebase**: Remember this has both TypeScript (frontend) and Python (backend)

### Quick Reference

**Want to add a feature?** → Start in [CONTRIBUTING.md](CONTRIBUTING.md)

**Fixing a bug?** → Write test first in [src/__tests__/](src/__tests__/)

**Updating docs?** → User docs in [README.md](README.md), technical in `docs/`

**Working with APIs?** → Check [src/service/](src/service/) for patterns

**Need architecture overview?** → Read [src/index.ts](src/index.ts)

**Testing?** → See [TESTING.md](TESTING.md)

**Release process?** → See [RELEASE.md](RELEASE.md)

**Local setup?** → See [LOCAL_SETUP.md](LOCAL_SETUP.md)
