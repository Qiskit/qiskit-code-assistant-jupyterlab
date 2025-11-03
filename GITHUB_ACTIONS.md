# GitHub Actions CI/CD

This document describes the continuous integration and testing workflows for the Qiskit Code Assistant JupyterLab extension.

## Overview

The repository uses GitHub Actions to automatically test code changes, validate the setup script, and ensure quality standards. All workflows are defined in [`.github/workflows/`](.github/workflows/).

## Workflows

### Build Workflow

**File:** [`.github/workflows/build.yml`](.github/workflows/build.yml)

**Triggers:**

- Push to `main` branch
- Pull requests to any branch
- Weekly schedule (Mondays at 00:00 UTC)
- Manual dispatch

**Jobs:**

#### 1. `build`

Builds and validates the JupyterLab extension.

**Steps:**

- Checkout code
- Install dependencies
- Lint the extension (Prettier, ESLint, Stylelint)
- Build the extension
- Verify server and lab extension installation
- Package the extension
- Upload build artifacts

**Platform:** Ubuntu Latest
**Duration:** ~5-10 minutes

---

#### 2. `test_isolated`

Tests the packaged extension in an isolated environment without Node.js.

**Steps:**

- Download build artifacts
- Install JupyterLab and extension from wheel
- Verify extension is properly installed
- Run browser checks

**Platform:** Ubuntu Latest
**Python:** 3.9
**Duration:** ~3-5 minutes

---

#### 3. `test_setup_script`

Fast validation tests for the local setup script.

**Runs on:** Every PR and push to `main`

**Platforms:**

- Ubuntu Latest
- macOS Latest

**Tests:**

- ✅ Script syntax validation (`bash -n`)
- ✅ `--help` flag functionality
- ✅ `--list-models` flag functionality
- ✅ Function definitions (`detect_os()`, `install_or_upgrade_extension()`, `detect_package_manager()`)
- ✅ JupyterLab installation
- ✅ Extension installation and upgrade with `--upgrade` flag

**Duration:** ~5-10 minutes per platform

---

#### 4. `test_setup_script_full`

Comprehensive end-to-end test of the setup script with Ollama model.

**Runs when:**

- ✅ `setup_local.sh` is modified in a PR/push
- ✅ Manually triggered via workflow dispatch
- ✅ Weekly on Mondays at 00:00 UTC (scheduled)
- ✅ Release tags are pushed (e.g., `v0.8.0`)

**Platform:** Ubuntu Latest

**Features:**

- **Model Caching:** Downloads ~9GB Qwen model once, then reuses cached version
- **Cache Key:** Based on `DEFAULT_MODEL` value in script
- **Cache Duration:** 7 days (refreshed by weekly runs)
- **Non-Interactive Mode:** Uses `--non-interactive` flag for automated testing

**Steps:**

1. Detect if `setup_local.sh` was modified
2. Set up Python 3.11
3. Restore Ollama model from cache (or download if not cached)
4. Install and start Ollama service
5. Run `setup_local.sh --non-interactive`
6. Verify model installation
7. Test model inference with Qiskit code
8. Verify JupyterLab configuration files

**Duration:**

- First run (no cache): ~35-45 minutes
- Subsequent runs (cached): ~10-15 minutes

---

#### 5. `check_links`

Validates all links in documentation files.

**Platform:** Ubuntu Latest
**Duration:** ~2-3 minutes

---

## Setup Script Features Tested

### Non-Interactive Mode

The `setup_local.sh` script supports a `--non-interactive` or `-y` flag for CI/CD and automation:

```bash
# Interactive (default)
bash setup_local.sh

# Non-interactive (for CI/CD)
bash setup_local.sh --non-interactive
bash setup_local.sh -y
```

**What it does:**

- Auto-installs JupyterLab if missing (no prompt)
- Auto-upgrades extension to latest version
- Proceeds with default options automatically

### Extension Auto-Upgrade

The setup script **always upgrades** the JupyterLab extension to the latest version:

```bash
# Runs automatically in setup script
pip install --upgrade qiskit_code_assistant_jupyterlab
# or with uv:
uv pip install --upgrade qiskit_code_assistant_jupyterlab
```

This ensures users always have the latest bug fixes and features.

---

## Caching Strategy

### Ollama Model Cache

The full integration test uses GitHub Actions cache to store the Ollama model:

**Cache Location:** `~/.ollama`
**Cache Key:** `ollama-models-<MODEL_NAME>`
**Example:** `ollama-models-hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF`

**Benefits:**

- ✅ First run downloads ~9GB model (20-30 min)
- ✅ Subsequent runs restore from cache (~2 min)
- ✅ Cache expires after 7 days of inactivity
- ✅ Weekly schedule keeps cache fresh

**Cache Invalidation:**

- Automatically invalidates when `DEFAULT_MODEL` in `setup_local.sh` changes
- Manual cache clear via GitHub Actions UI

---

## Running Tests Manually

### Trigger Full Integration Test

You can manually trigger the expensive full integration test:

1. Go to **Actions** tab in GitHub
2. Select **Build** workflow
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow** button

This is useful for:

- Testing before releases
- Validating major changes to setup script
- Debugging issues in the full setup flow

---

## CI/CD Best Practices

### When to Run Full Test

The `test_setup_script_full` job is designed to be expensive but thorough. It runs:

| Scenario                    | Rationale                                         |
| --------------------------- | ------------------------------------------------- |
| **setup_local.sh modified** | Validate changes immediately                      |
| **Weekly schedule**         | Catch upstream dependency issues (Ollama, models) |
| **Manual trigger**          | Pre-release validation                            |
| **Release tags**            | Final validation before release                   |

### Resource Optimization

**Fast tests** (`test_setup_script`) run on every PR:

- Multi-platform (Ubuntu + macOS)
- No model downloads
- Complete in ~5-10 minutes
- Validate script logic

**Full test** (`test_setup_script_full`) runs conditionally:

- Single platform (Ubuntu only)
- Downloads 9GB model (cached)
- Complete in ~10-45 minutes
- End-to-end validation

---

## Schedule Configuration

### Current Schedule

```yaml
schedule:
  - cron: '0 0 * * 1' # Mondays at 00:00 UTC
```

### Customizing Schedule

To change the schedule, edit [`.github/workflows/build.yml`](.github/workflows/build.yml):

```yaml
# Daily at 2 AM UTC
- cron: '0 2 * * *'

# Twice weekly (Monday & Thursday)
- cron: '0 0 * * 1,4'

# Monthly on 1st at midnight
- cron: '0 0 1 * *'
```

**Cron syntax:** `minute hour day month weekday`

---

## Troubleshooting

### Test Failures

#### Lint Failures

If Prettier, ESLint, or Stylelint fail:

```bash
# Run locally to fix
source env/bin/activate
npm run prettier  # Auto-fix formatting
npm run lint:check  # Check all linting
```

#### Full Test Timeout

If `test_setup_script_full` times out:

- Check Ollama installation logs
- Verify model download didn't stall
- Increase timeout in workflow (currently 45 min)

#### Cache Issues

If model cache is corrupted:

1. Go to **Actions** → **Caches** in GitHub
2. Delete `ollama-models-*` caches
3. Re-run workflow to rebuild cache

---

## GitHub Actions Limits

**Free tier (public repos):**

- Unlimited minutes for public repositories
- 10GB cache storage per repository
- 7-day cache expiration

**Current usage:**

- Model cache: ~9GB (Qwen 14B)
- Weekly refresh prevents expiration
- Well within free tier limits

---

## Local Development

### Test Script Locally

```bash
# Syntax check
bash -n setup_local.sh

# Test help
bash setup_local.sh --help

# Test list models
bash setup_local.sh --list-models

# Test full setup (interactive)
bash setup_local.sh

# Test full setup (non-interactive)
bash setup_local.sh --non-interactive
```

### Test Extension Upgrade

```bash
# Install extension
pip install .

# Upgrade extension
pip install --upgrade .

# Verify upgrade worked
pip show qiskit-code-assistant-jupyterlab
```

---

## Related Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [LOCAL_SETUP.md](LOCAL_SETUP.md) - Detailed local setup instructions
- [GETTING_STARTED.md](GETTING_STARTED.md) - Getting started guide
- [setup_local.sh](setup_local.sh) - Local setup script

---

## Support

If you encounter issues with GitHub Actions:

1. Check the [Actions tab](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/actions) for detailed logs
2. Review the [Issues page](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/issues) for similar problems
3. Open a new issue with:
   - Workflow run URL
   - Error message
   - Expected behavior
