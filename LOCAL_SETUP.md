# Qiskit Code Assistant - Local Setup Guide

Run the Qiskit Code Assistant entirely on your local machine using our Qiskit open-source models!

## Quick Start (One Command)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Qiskit/qiskit-code-assistant-jupyterlab/main/setup_local.sh)
```

Or clone the repository and run:

```bash
bash setup_local.sh
```

That's it! The script will:

- Check and optionally install JupyterLab (if not present)
- Always upgrade the Qiskit Code Assistant extension to the latest version
- Install Ollama (if not already installed)
- Download the recommended Qiskit model
- Configure optimal model parameters
- Set up JupyterLab extension settings
- Verify everything is working

### Non-Interactive Mode

For CI/CD pipelines or automated setups, use the `--non-interactive` flag to skip all prompts:

```bash
bash setup_local.sh --non-interactive
# Or use the short form:
bash setup_local.sh -y
```

This will automatically:

- Install JupyterLab if missing (no prompt)
- Upgrade the extension to the latest version
- Proceed with all default options

## Requirements

- **Operating System**: macOS, Linux, or Windows (via Git Bash or WSL)
- **Python**: Python 3.8+ with pip installed
- **RAM**: Minimum 8GB (16GB+ recommended for larger models)
- **Disk Space**: ~5-20GB depending on model size
- **Windows Users**: Git Bash (comes with Git for Windows) or WSL recommended

The script will automatically:

- Detect and use `uv` for faster Python package installation (falls back to `pip` if not available)
- Check for and offer to install JupyterLab (version 4.3.0 or higher)
- Check for and offer to install `qiskit_code_assistant_jupyterlab` extension

## Available Models

The setup script supports multiple models. By default, it uses **Qwen2.5-Coder 14B** which offers the best quality for code generation.

### Model Options

| Model                           | Size  | Quality                                               | RAM Required | Command                                          |
| ------------------------------- | ----- | ----------------------------------------------------- | ------------ | ------------------------------------------------ |
| **Qwen2.5-Coder 14B** (Default) | ~9GB  | Best for code                                         | 16GB+        | `hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF`     |
| Mistral Small 24B               | ~15GB | Most recent model                                     | 24GB+        | `hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF` |
| Granite 3.3 8B                  | ~5GB  | Lightweight option, less accurate for code generation | 8GB+         | `hf.co/Qiskit/granite-3.3-8b-qiskit-GGUF`        |

All models are trained on **Qiskit 2.0+** and optimized for quantum computing code assistance.

**Built-in System Prompt**: These models include a comprehensive system prompt embedded in their chat template that defines them as Qiskit coding experts. The prompt emphasizes Qiskit 2.0 best practices, modern primitives (SamplerV2/EstimatorV2), and PassManagers instead of deprecated methods.

### Choosing a Different Model

```bash
# Use the most recent model (Mistral Small 24B) if you have 24GB+ RAM
bash setup_local.sh hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF

# For systems with 8-12GB RAM (lightweight option, less accurate)
bash setup_local.sh hf.co/Qiskit/granite-3.3-8b-qiskit-GGUF

# Combine with non-interactive mode for automation
bash setup_local.sh -y hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF
```

### Script Options

```bash
# Show help
bash setup_local.sh --help

# List available models
bash setup_local.sh --list-models

# Non-interactive mode (for automation)
bash setup_local.sh --non-interactive
bash setup_local.sh -y
```

## Manual Setup (Alternative)

If you prefer to set up manually or the script doesn't work for your system:

**Note:** For faster Python package installations, consider using [uv](https://docs.astral.sh/uv/) instead of pip. Simply replace `pip install` with `uv pip install` in the commands below.

### Step 1: Install Ollama

**macOS:**

```bash
# Download from https://ollama.com/download
# Or use Homebrew
brew install ollama
```

**Linux:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**

```bash
# Download the installer from https://ollama.com/download
# Run the .exe installer
# Then verify in Git Bash or WSL:
ollama --version
```

### Step 2: Download and Configure Model

```bash
# Pull the default model
ollama pull hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF

# Create optimized Modelfile
cat > ~/qiskit-modelfile <<EOF
FROM hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF

PARAMETER temperature 0
PARAMETER top_k 1
PARAMETER top_p 1
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 4096

# Note: The GGUF model has an embedded chat template with a comprehensive system prompt
# Ollama automatically uses this template - no SYSTEM or TEMPLATE directive needed
# The embedded prompt: "You are the Qiskit code assistant, a Qiskit coding expert
# developed by IBM Quantum..." includes Qiskit 2.0 best practices and guidance
EOF

# Create optimized model with a display-friendly name
# This creates a model named "qwen2.5-coder-14b-qiskit-GGUF"
ollama create qwen2.5-coder-14b-qiskit-GGUF -f ~/qiskit-modelfile
```

**Note:** The model name is shortened for better display in the extension UI by removing the `hf.co/Qiskit/` prefix and converting to lowercase. The `-qiskit-GGUF` suffix is kept to indicate it's a Qiskit-optimized model in GGUF format. The full HuggingFace name is `hf.co/Qiskit/Qwen2.5-Coder-14B-Qiskit-GGUF`. For other models, use similar shortened names (e.g., `mistral-small-3.2-24b-qiskit-GGUF` or `granite-3.3-8b-qiskit-GGUF`).

### Step 3: Configure JupyterLab Extension

**Important:** If JupyterLab is already running, you must restart it after changing the configuration.

Create or edit the configuration files (update both locations to ensure it works):

```bash
# Primary location (scoped)
mkdir -p ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab

cat > ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings <<EOF
{
  "serviceUrl": "http://localhost:11434",
  "enableCompleter": true,
  "enableTelemetry": false,
  "enableStreaming": true
}
EOF

# Alternative location (unscoped) - also update this
mkdir -p ~/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab

cat > ~/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings <<EOF
{
  "serviceUrl": "http://localhost:11434",
  "enableCompleter": true,
  "enableTelemetry": false,
  "enableStreaming": true
}
EOF
```

**Note:** The extension auto-detects that Ollama is an OpenAI-compatible service and uses the `/v1/completions` endpoint. Streaming is enabled for faster response feedback from Ollama.

### Step 4: Start Ollama and JupyterLab

```bash
# Verify Ollama is running
curl http://localhost:11434

# If JupyterLab is already running, stop it first (Ctrl+C)
# Then start/restart JupyterLab
jupyter lab
```

**Verify Configuration:**
After JupyterLab starts:

1. Go to **Settings → Settings Editor**
2. Search for "Qiskit Code Assistant"
3. Verify that **serviceUrl** shows `http://localhost:11434`
4. If it still shows the IBM URL, refresh the page or restart JupyterLab

## Using the Code Assistant

Once set up, the Qiskit Code Assistant works just like the cloud version:

### Keyboard Shortcuts

- **`Alt + .`** or **`Alt + \`** - Trigger code completion
- **`Alt + [`** and **`Alt + ]`** - Cycle through suggestions
- **`Alt + Tab`** or **`Alt + End`** - Accept suggestion

### Example Usage

1. Open a Jupyter notebook
2. Start typing Qiskit code:

   ```python
   from qiskit import QuantumCircuit

   # Create a Bell state
   qc = QuantumCircuit(2)
   qc.h(0)  # Press Alt+. here for suggestions
   ```

3. Press `Alt + .` to get AI-powered completions
4. Press `Alt + Tab` to accept the suggestion

## Configuration

### JupyterLab Settings

You can customize the extension behavior in JupyterLab Settings Editor:

1. Open JupyterLab
2. Go to Settings → Settings Editor
3. Search for "Qiskit Code Assistant"

Available settings:

- **serviceUrl**: Ollama endpoint (default: `http://localhost:11434`)
- **enableCompleter**: Enable/disable code completion
- **enableTelemetry**: Send usage data (disabled by default for local)
- **enableStreaming**: Stream responses for faster feedback

### Inline Completer Settings

Recommended settings for the best experience:

1. Go to Settings → Inline Completer
2. Set **showWidget** to `always` to always see the completion widget
3. Go to Settings → Code Completion
4. Set **providerTimeout** to `15000` (15 seconds)

## Troubleshooting

### Extension Not Working

**Check Ollama is Running:**

```bash
curl http://localhost:11434
# Should return: "Ollama is running"
```

**List Available Models:**

```bash
ollama list
```

**Test the Model:**

```bash
# Use the shortened model name created by the setup script
ollama run qwen2.5-coder-14b-qiskit-GGUF
# Or for other models:
# ollama run mistral-small-3.2-24b-qiskit-GGUF
# ollama run granite-3.3-8b-qiskit-GGUF

# Type some Qiskit code and see if it responds
```

### Check Extension Installation

```bash
# Check server extension
jupyter server extension list
# Should show: qiskit_code_assistant_jupyterlab

# Check frontend extension
jupyter labextension list
# Should show: qiskit-code-assistant-jupyterlab
```

### How OpenAI-Compatible API Integration Works

The extension automatically detects OpenAI-compatible services (including Ollama):

1. **Auto-detection:** When `serviceUrl` is set to a service endpoint, the extension makes a test request to detect the service type
2. **OpenAI mode:** If the service doesn't return `"name": "qiskit-code-assistant"`, the extension activates OpenAI compatibility mode
3. **Endpoint usage:** In OpenAI mode, the extension uses `/v1/completions` endpoint
4. **Streaming:** Enabled by default for faster response feedback. The extension handles both:
   - **NDJSON format** (Ollama): `{...}\n{...}\n`
   - **SSE format** (OpenAI, others): `data: {...}\n\ndata: {...}\n\n`
   - Partial chunks are buffered until complete JSON objects are received

### Configuration Issues

**Extension Still Shows IBM URL:**

If the extension still shows `https://qiskit-code-assistant.quantum.ibm.com` after running the setup script:

1. **Verify Configuration Files:**

   ```bash
   # Check both possible config locations
   cat ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings
   cat ~/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings
   ```

   Both should show `"serviceUrl": "http://localhost:11434"`

2. **Restart JupyterLab (Critical):**
   - Stop JupyterLab completely (Ctrl+C in the terminal)
   - Wait a few seconds
   - Start it again: `jupyter lab`
   - Do NOT just refresh the browser - you must restart the server

3. **Clear Browser Cache:**
   - Hard refresh: Ctrl+Shift+R (Linux/Windows) or Cmd+Shift+R (macOS)
   - Or clear browser cache for the JupyterLab site

4. **Verify in JupyterLab UI:**
   - Open JupyterLab
   - Go to Settings → Settings Editor
   - Search for "Qiskit Code Assistant"
   - The serviceUrl field should show `http://localhost:11434`

**Check Configuration Files:**

```bash
# Primary location (scoped)
cat ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings

# Alternative location (unscoped)
cat ~/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings
```

**Reset Configuration:**

```bash
# Remove both config files
rm ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings
rm ~/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings
# Then run setup_local.sh again
```

### Performance Issues

**Model Takes Too Long:**

- Try a smaller model (e.g., Granite 3.3 8B instead of Mistral Small 24B)
- Increase JupyterLab timeout settings
- Check system resources (RAM, CPU usage)

**Out of Memory:**

```bash
# Check Ollama logs
journalctl -u ollama  # Linux
# Or check Console.app on macOS

# Try a smaller model
ollama pull hf.co/Qiskit/granite-3.3-8b-qiskit-GGUF
```

**Completions Not Relevant:**

- Ensure you're using a model trained on Qiskit
- Check that the system prompt is set correctly
- Try adjusting temperature and other parameters in the Modelfile

### Common Error Messages

**"Service not reachable"**

- Ollama is not running or not accessible
- Check: `curl http://localhost:11434`
- Solution: Start Ollama service

**"Model not found"**

- The model hasn't been downloaded
- Check: `ollama list`
- Solution: Run `ollama pull <model_name>`

**"Connection refused"**

- Wrong service URL configured
- Check your JupyterLab settings
- Should be: `http://localhost:11434`

## Advanced Configuration

### Using Different Ollama Endpoints

If you're running Ollama on a different machine or port:

```bash
# Edit the configuration file
cat > ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab/plugin.jupyterlab-settings <<EOF
{
  "serviceUrl": "http://your-server:11434",
  "enableCompleter": true
}
EOF
```

### Custom Model Parameters

Create a custom Modelfile to fine-tune behavior:

```bash
cat > ~/custom-modelfile <<EOF
FROM hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF

# Adjust these parameters based on your needs
PARAMETER temperature 0.1        # Higher = more creative (0-1)
PARAMETER top_k 5                # Number of tokens to consider
PARAMETER top_p 0.9              # Nucleus sampling threshold
PARAMETER repeat_penalty 1.1     # Penalize repetition (1.0 = no penalty)
PARAMETER num_ctx 8192           # Context window size

# Note: The model has a comprehensive built-in system prompt via its chat template
# Only add a SYSTEM directive if you want to override the default behavior

# To use the built-in prompt (recommended):
# (no SYSTEM directive needed)

# To override with a custom system prompt (advanced):
# SYSTEM """Your custom prompt here"""
EOF

ollama create my-custom-qwen -f ~/custom-modelfile
```

**Note:** Use descriptive model names that reflect the base model and any customizations (e.g., `my-custom-qwen`, `qwen-temp-0.2`, etc.).

### GPU Acceleration

Ollama automatically uses GPU if available. To verify:

```bash
# Check GPU usage while running a completion
nvidia-smi  # NVIDIA GPUs
# Or check Activity Monitor (macOS) / System Monitor (Linux)
```

### Running Multiple Models

You can have multiple models and switch between them:

```bash
# Download multiple models
ollama pull hf.co/Qiskit/Granite-3.3-8B-Qiskit-GGUF
ollama pull hf.co/Qiskit/Qwen2.5-Coder-14B-Qiskit-GGUF

# Create models with shortened display-friendly names
ollama create granite-3.3-8b-qiskit-GGUF -f ~/granite-modelfile
ollama create qwen2.5-coder-14b-qiskit-GGUF -f ~/qwen-modelfile

# List all models
ollama list

# Switch between models by name
ollama run granite-3.3-8b-qiskit-GGUF      # Fast, smaller model
ollama run qwen2.5-coder-14b-qiskit-GGUF   # Better quality, larger model
```

## Privacy & Security

### Benefits of Local Deployment

- **Complete Privacy**: Your code never leaves your machine
- **No Internet Required**: Works offline once models are downloaded
- **No Telemetry**: Disabled by default in local setup
- **Full Control**: Customize models and parameters as needed

### Data Handling

When running locally:

- No data is sent to IBM or external services
- All processing happens on your local machine
- No API tokens or authentication required
- You control all model parameters and behavior

## Comparison: Local vs Cloud

| Feature           | Local Setup               | IBM Quantum Cloud        |
| ----------------- | ------------------------- | ------------------------ |
| **Cost**          | Free                      | Requires Premium Account |
| **Privacy**       | Complete                  | Data sent to IBM         |
| **Speed**         | Depends on hardware       | Consistent               |
| **Internet**      | Only for initial download | Required                 |
| **Setup**         | One-time setup needed     | Immediate access         |
| **Model Updates** | Manual                    | Automatic                |
| **Resources**     | Uses your RAM/CPU         | Uses IBM infrastructure  |

## Uninstalling

To remove the local setup:

```bash
# Remove Ollama models
# List models first to see what's installed
ollama list

# Remove models by their names (use exact names from 'ollama list')
ollama rm qwen2.5-coder-14b-qiskit-GGUF
# Or remove other models if you installed them:
# ollama rm mistral-small-3.2-24b-qiskit-GGUF
# ollama rm granite-3.3-8b-qiskit-GGUF

# Uninstall Ollama (optional)
# macOS: Remove Ollama.app from Applications
# Linux:
sudo systemctl stop ollama
sudo systemctl disable ollama
sudo rm /usr/local/bin/ollama
sudo rm -rf /usr/share/ollama

# Remove JupyterLab configuration
rm -rf ~/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab
```

## Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review [GETTING_STARTED.md](GETTING_STARTED.md) for general extension usage
3. Report issues at: [GitHub Issues](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/issues)
4. Join the Qiskit Slack community

## Additional Resources

- **Ollama Documentation**: https://ollama.com/docs
- **Qiskit Organization in HuggingFace**: https://huggingface.co/Qiskit
- **Qiskit Code Assistant Docs**: https://quantum.cloud.ibm.com/docs/en/guides/qiskit-code-assistant-local

## Contributing

Found a way to improve the local setup? Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
