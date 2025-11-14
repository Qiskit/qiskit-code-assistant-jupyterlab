# Qiskit Code Assistant (Beta) Jupyterlab Extension

[![Build](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/workflows/Build/badge.svg)](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/actions/workflows/build.yml)

A JupyterLab extension for Qiskit Code Assistant

You can also use the [VSCode extension](https://github.com/Qiskit/qiskit-code-assistant-vscode)
if you dont have access to Jupyterlab

This extension is composed of a Python package named `qiskit_code_assistant_jupyterlab`
for the server extension and a NPM package named `qiskit-code-assistant-jupyterlab`
for the frontend extension.

## Requirements

- JupyterLab >= 4.3.0
- Access to either:
  - An IBM Quantum premium account
  - A local LLM service (e.g., Ollama with Qiskit models)
  - A service exposing LLMs using OpenAI-compatible API endpoints

## Install

To install the extension, execute:

```bash
pip install qiskit_code_assistant_jupyterlab
```

## Quick Start

### Option 1: IBM Quantum Cloud (Recommended)

Use IBM's hosted service with a premium account for the best experience:

1. Get your API token from [IBM Quantum](https://quantum.cloud.ibm.com/)
2. Start JupyterLab: `jupyter lab`
3. Click the status bar when prompted and enter your API token
4. Select a model

See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed setup instructions.

#### Managing Multiple Credentials

If you have multiple IBM Quantum credentials configured in your `~/.qiskit/qiskit-ibm.json` file (e.g., for different environments like production and development), the extension will automatically prompt you to select which credential to use when it starts. You can choose to select one from the file, enter a token manually, or dismiss the prompt to use automatic selection. See [docs/credential_selection.md](docs/credential_selection.md) for detailed instructions.

### Option 2: Local Setup (For Non-Premium Users)

If you don't have an IBM Quantum Premium account, run the Qiskit Code Assistant entirely on your local machine:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Qiskit/qiskit-code-assistant-jupyterlab/main/setup_local.sh)
```

For automated/CI setups, use non-interactive mode:

```bash
bash setup_local.sh --non-interactive
# Or: bash setup_local.sh -y
```

This one command will:

- Detect and use `uv` for faster installations (if available)
- Check and optionally install JupyterLab
- Always upgrade the extension to the latest version
- Install and configure Ollama
- Download the Qwen2.5-Coder 14B model (optimized for Qiskit)
- Set up the JupyterLab extension automatically

**Note:** Requires Python 3.8+ and 16GB+ RAM for optimal performance. For faster installations, consider installing [uv](https://docs.astral.sh/uv/).

For detailed instructions, see [LOCAL_SETUP.md](LOCAL_SETUP.md).

## Uninstall

To remove the extension, execute:

```bash
pip uninstall qiskit_code_assistant_jupyterlab
```

## Using the Qiskit Code Assistant

- **Local Setup**: See [LOCAL_SETUP.md](LOCAL_SETUP.md) for running models locally with Ollama
- **Cloud Setup**: See [GETTING_STARTED.md](GETTING_STARTED.md) for using IBM Quantum Cloud

### Features

#### Code Migration

The extension includes a code migration feature that helps you migrate legacy Qiskit code to newer versions:

- **Single Cell Migration**: Right-click on a code cell and select "Migrate code" from the context menu to migrate just that cell
- **Full Notebook Migration**: Click the migration button in the notebook toolbar (next to the cell type dropdown) to migrate all code cells in the notebook
- **Streaming Support**: Real-time updates as the migration processes your code (configurable via settings)

The migration feature automatically:
- Detects code that needs migration to newer Qiskit versions
- Updates deprecated APIs and patterns
- Preserves your code structure and comments
- Skips markdown cells and empty code cells

**Note**: Migration requires an active API connection to IBM Quantum Cloud or a compatible local LLM service.

## Contributing

To learn more about contributing or installing locally read [CONTRIBUTING](CONTRIBUTING.md).

## Qiskit Code Assistant Terms of use

- [End User License Agreement (EULA)](docs/EULA.md) acceptance required before starting to use the model acceptance required before starting to use the model
- Terms of use: [https://quantum.ibm.com/terms](https://quantum.ibm.com/terms)
- Privacy policy: [https://quantum.ibm.com/terms/privacy](https://quantum.ibm.com/terms/privacy)
- Cloud Services Agreement [https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en)
- IBM Cloud Service Description [https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en)
