# Quick Start Guide

Get Qiskit Code Assistant running in under 5 minutes!

## Step 1: Install the Extension

```bash
pip install qiskit_code_assistant_jupyterlab
```

## Step 2: Choose Your Setup

### Option A: IBM Quantum Cloud (Recommended)

**Requirements:**
- IBM Quantum Premium account
- Internet connection

**Setup:**
1. Get your API token from [IBM Quantum](https://quantum.cloud.ibm.com/)
2. Start JupyterLab: `jupyter lab`
3. Click the status bar when prompted
4. Enter your API token
5. Select a model

See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed cloud setup instructions.

**Advantages:**
- ✅ No local resources needed
- ✅ Automatic model updates
- ✅ Consistent performance
- ✅ Best user experience

### Option B: Local Setup (For Non-Premium Users)

If you don't have an IBM Quantum Premium account, you can run locally:

**One command to set everything up:**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Qiskit/qiskit-code-assistant-jupyterlab/main/setup_local.sh)
```

**Or if you cloned the repo:**

```bash
bash setup_local.sh
```

**What this does:**
- Detects and uses `uv` for faster installations (if available)
- Checks and optionally installs JupyterLab (if needed)
- Checks and optionally installs the extension (if needed)
- Installs Ollama (if needed)
- Downloads the Qwen2.5-Coder 14B model (~9GB)
- Configures optimal model parameters
- Sets up JupyterLab extension automatically

**Requirements:**
- Python 3.8+ with pip installed
- 16GB+ RAM (8GB+ for lighter models)
- ~5-20GB disk space (depending on model)
- macOS, Linux, or Windows (Git Bash/WSL)

**Advantages:**
- ✅ Free and open source
- ✅ Complete privacy (runs on your machine)
- ✅ Works offline
- ✅ No API tokens needed

## Step 3: Start Using

1. **Launch JupyterLab:**
   ```bash
   jupyter lab
   ```

2. **Create or open a notebook**

3. **Start coding with AI assistance:**
   ```python
   from qiskit import QuantumCircuit

   # Create a Bell state
   qc = QuantumCircuit(2)
   qc.h(0)  # Press Alt+. here
   ```

4. **Use keyboard shortcuts:**
   - `Alt + .` → Trigger completion
   - `Alt + Tab` → Accept suggestion
   - `Alt + [` / `Alt + ]` → Cycle suggestions

## Recommended Settings

For the best experience, adjust these JupyterLab settings:

1. **Settings → Inline Completer:**
   - Set `showWidget` to `always`

2. **Settings → Code Completion:**
   - Set `providerTimeout` to `15000` (15 seconds)

## Troubleshooting

### Local Setup Issues

**Model not responding?**
```bash
# Check Ollama is running
curl http://localhost:11434

# List installed models
ollama list

# Test the model (use the exact name shown in 'ollama list')
# Default model:
ollama run qwen2.5-coder-14b-qiskit-GGUF
# Or for other models:
# ollama run mistral-small-3.2-24b-qiskit-GGUF
# ollama run granite-3.3-8b-qiskit-GGUF
```

**Extension not found?**
```bash
# Check installation
jupyter labextension list | grep qiskit

# Reinstall if needed
pip install --upgrade qiskit_code_assistant_jupyterlab
```

### Cloud Setup Issues

**"Service not reachable"?**
- Check your API token in Settings → Qiskit Code Assistant
- Verify internet connection
- Check IBM Quantum status

## Next Steps

- 📖 Read the full [Local Setup Guide](LOCAL_SETUP.md) for advanced configuration
- 📖 Read the [Getting Started Guide](GETTING_STARTED.md) for cloud setup
- 🎓 Check out [Qiskit tutorials](https://docs.quantum.ibm.com) to learn more
- 💬 Join the [Qiskit Slack](https://qisk.it/join-slack) community

## Choosing the Right Model (Local Setup)

Choose based on your available RAM:

| Your RAM | Recommended Model | Command |
|----------|------------------|---------|
| **16-20 GB** | **Qwen2.5-Coder 14B** (Default, Recommended) | `bash setup_local.sh` |
| 24+ GB   | Mistral Small 24B (Highest quality) | `bash setup_local.sh hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF` |
| 8-12 GB  | Granite 3.3 8B (Limited RAM fallback) | `bash setup_local.sh hf.co/Qiskit/granite-3.3-8b-qiskit-GGUF` |

**Note:** For best results, we strongly recommend 16GB+ RAM to use the Qwen2.5-Coder 14B model.

## Getting Help

- 📁 Check the troubleshooting sections in [LOCAL_SETUP.md](LOCAL_SETUP.md#troubleshooting)
- 🐛 Report issues: [GitHub Issues](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/issues)
- 💬 Ask questions: [Qiskit Slack](https://qisk.it/join-slack)
- 📚 Read the docs: [IBM Quantum Docs](https://quantum.cloud.ibm.com/docs)

Happy quantum coding! 🚀
