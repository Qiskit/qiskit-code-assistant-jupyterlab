#!/bin/bash

# Qiskit Code Assistant - Local Setup Script
# This script automates the setup of Qiskit Code Assistant with a local Ollama backend
# Usage: bash setup_local.sh [model_name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default model - Qwen2.5-Coder 14B (best quality for code generation)
DEFAULT_MODEL="hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF"
MODEL_NAME="${1:-$DEFAULT_MODEL}"

# Configuration
OLLAMA_URL="http://localhost:11434"
JUPYTER_CONFIG_DIR="$HOME/.jupyter/lab/user-settings/@qiskit/qiskit-code-assistant-jupyterlab"
JUPYTER_CONFIG_FILE="$JUPYTER_CONFIG_DIR/plugin.jupyterlab-settings"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Qiskit Code Assistant - Local Setup                      ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Detect OS
detect_os() {
    print_status "Detecting operating system..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_success "Detected macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Detected Linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
        print_success "Detected Windows (Git Bash/WSL)"
    else
        print_error "Unsupported operating system: $OSTYPE"
        print_warning "This script supports macOS, Linux, and Windows (via Git Bash or WSL)."
        exit 1
    fi
}

# Check if Ollama is installed
check_ollama_installed() {
    if command -v ollama &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Install Ollama
install_ollama() {
    print_status "Installing Ollama..."

    if check_ollama_installed; then
        print_success "Ollama is already installed"
        return 0
    fi

    if [[ "$OS" == "macos" ]]; then
        print_status "Installing Ollama for macOS..."

        # Check if Homebrew is available for easier installation
        if command -v brew &> /dev/null; then
            print_status "Homebrew detected, installing via brew..."
            if brew install ollama; then
                print_success "Ollama installed via Homebrew"
            else
                print_error "Homebrew installation failed"
                print_warning "Attempting manual download..."
                install_ollama_macos_manual
            fi
        else
            print_warning "Homebrew not found, using direct download method..."
            install_ollama_macos_manual
        fi
    elif [[ "$OS" == "linux" ]]; then
        print_status "Installing Ollama for Linux..."
        curl -fsSL https://ollama.com/install.sh | sh
    elif [[ "$OS" == "windows" ]]; then
        print_status "Installing Ollama for Windows..."
        print_warning "Automatic installation not available for Windows."
        print_warning "Please download and install Ollama from: https://ollama.com/download"
        print_warning "Download OllamaSetup.exe and run it."
        print_warning "After installation, press Enter to continue..."
        read -r

        if ! check_ollama_installed; then
            print_error "Ollama installation not detected. Please install manually."
            exit 1
        fi
    fi

    if ! check_ollama_installed; then
        print_error "Ollama installation failed. Please install manually from https://ollama.com/download"
        exit 1
    fi

    print_success "Ollama installed successfully"
}

# Manual installation for macOS (download and extract)
install_ollama_macos_manual() {
    print_status "Downloading Ollama for macOS..."

    # Download the Ollama CLI binary
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR" || exit 1

    if curl -fsSL https://ollama.com/download/ollama-darwin -o ollama; then
        print_status "Installing Ollama to /usr/local/bin..."
        chmod +x ollama

        # Try to install to /usr/local/bin (may require sudo)
        if mv ollama /usr/local/bin/ollama 2>/dev/null; then
            print_success "Ollama installed to /usr/local/bin/ollama"
        else
            print_warning "Need elevated privileges to install to /usr/local/bin"
            sudo mv ollama /usr/local/bin/ollama
            print_success "Ollama installed to /usr/local/bin/ollama"
        fi

        cd - > /dev/null
        rm -rf "$TEMP_DIR"
    else
        print_error "Failed to download Ollama"
        cd - > /dev/null
        rm -rf "$TEMP_DIR"
        print_warning "Please download manually from: https://ollama.com/download"
        print_warning "After installation, press Enter to continue..."
        read -r
    fi
}

# Start Ollama service
start_ollama() {
    print_status "Starting Ollama service..."

    # Check if Ollama is already running
    if curl -s "$OLLAMA_URL" &> /dev/null; then
        print_success "Ollama is already running"
        return 0
    fi

    if [[ "$OS" == "macos" ]] || [[ "$OS" == "windows" ]]; then
        # On macOS/Windows, Ollama runs as an app, just verify it's accessible
        print_status "Waiting for Ollama to start..."
        sleep 3

        if curl -s "$OLLAMA_URL" &> /dev/null; then
            print_success "Ollama service is running"
        else
            print_warning "Please start the Ollama application manually"
            print_warning "Waiting for Ollama to be accessible at $OLLAMA_URL..."
            while ! curl -s "$OLLAMA_URL" &> /dev/null; do
                sleep 2
                echo -n "."
            done
            echo ""
            print_success "Ollama service is now running"
        fi
    elif [[ "$OS" == "linux" ]]; then
        # On Linux, we can start the service
        if systemctl is-active --quiet ollama; then
            print_success "Ollama service is running"
        else
            sudo systemctl start ollama
            sleep 2
            print_success "Ollama service started"
        fi
    fi
}

# Download and configure the model
setup_model() {
    print_status "Setting up Qiskit Code Assistant model: $MODEL_NAME"

    # Pull the model
    print_status "Downloading model (this may take several minutes)..."
    if ollama pull "$MODEL_NAME"; then
        print_success "Model downloaded successfully"
    else
        print_error "Failed to download model"
        exit 1
    fi

    # Create optimized Modelfile
    print_status "Creating optimized model configuration..."

    MODELFILE=$(cat <<EOF
FROM $MODEL_NAME

# Optimal parameters for Qiskit Code Assistant
PARAMETER temperature 0
PARAMETER top_k 1
PARAMETER top_p 1
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 4096

# Note: System prompt is embedded in the model's chat template
# The model includes a comprehensive Qiskit-specific system prompt
EOF
)

    echo "$MODELFILE" > /tmp/qiskit-modelfile

    # Create a shorter, display-friendly model name
    # Remove hf.co/ prefix, Qiskit/ namespace, and :latest tag
    # Keep the model name with -qiskit-GGUF suffix for clarity
    # Examples:
    #   hf.co/Qiskit/Qwen2.5-Coder-14B-Qiskit-GGUF -> qwen2.5-coder-14b-qiskit-GGUF
    #   hf.co/Qiskit/Mistral-Small-3.2-24B-Qiskit-GGUF -> mistral-small-3.2-24b-qiskit-GGUF
    #   hf.co/Qiskit/Granite-3.3-8B-Qiskit-GGUF -> granite-3.3-8b-qiskit-GGUF
    CUSTOM_MODEL_NAME=$(echo "$MODEL_NAME" | sed 's/hf\.co\/Qiskit\///' | sed 's/:latest$//' | tr '[:upper:]' '[:lower:]')

    print_status "Creating optimized model: $CUSTOM_MODEL_NAME..."

    if ollama create "$CUSTOM_MODEL_NAME" -f /tmp/qiskit-modelfile; then
        print_success "Optimized model created: $CUSTOM_MODEL_NAME"
    else
        print_error "Failed to create optimized model"
        print_warning "Will use base model name: $MODEL_NAME"
        CUSTOM_MODEL_NAME="$MODEL_NAME"
    fi

    rm /tmp/qiskit-modelfile

    # Test the model
    print_status "Testing model..."
    if echo "print('hello')" | ollama run "$CUSTOM_MODEL_NAME" &> /dev/null; then
        print_success "Model is working correctly"
    else
        print_warning "Model test failed, but this might be okay"
    fi

    echo "$CUSTOM_MODEL_NAME"
}

# Configure JupyterLab extension
configure_jupyterlab() {
    local model_name=$1

    print_status "Configuring JupyterLab extension..."

    # Configuration content
    CONFIG_CONTENT=$(cat <<EOF
{
  "serviceUrl": "$OLLAMA_URL",
  "enableCompleter": true,
  "enableTelemetry": false,
  "enableStreaming": true
}
EOF
)

    # Primary config location (scoped)
    mkdir -p "$JUPYTER_CONFIG_DIR"
    echo "$CONFIG_CONTENT" > "$JUPYTER_CONFIG_FILE"

    # Alternative config location (unscoped) - also update this
    ALT_CONFIG_DIR="$HOME/.jupyter/lab/user-settings/qiskit-code-assistant-jupyterlab"
    ALT_CONFIG_FILE="$ALT_CONFIG_DIR/plugin.jupyterlab-settings"
    mkdir -p "$ALT_CONFIG_DIR"
    echo "$CONFIG_CONTENT" > "$ALT_CONFIG_FILE"

    print_success "JupyterLab configuration updated in multiple locations"
    print_success "  - $JUPYTER_CONFIG_FILE"
    print_success "  - $ALT_CONFIG_FILE"

    print_warning "IMPORTANT: You must restart JupyterLab for changes to take effect"
    print_status "If JupyterLab is already running, please:"
    print_status "  1. Save your work"
    print_status "  2. Stop JupyterLab (Ctrl+C in the terminal)"
    print_status "  3. Start it again: jupyter lab"
}

# Detect if uv is available
detect_package_manager() {
    if command -v uv &> /dev/null; then
        PACKAGE_MANAGER="uv"
        print_success "Detected uv - will use for faster installations"
    else
        PACKAGE_MANAGER="pip"
    fi
}

# Install a Python package using uv or pip
install_python_package() {
    local package_name=$1

    if [ "$PACKAGE_MANAGER" = "uv" ]; then
        if uv pip install "$package_name"; then
            return 0
        else
            return 1
        fi
    else
        if pip install "$package_name"; then
            return 0
        else
            return 1
        fi
    fi
}

# Check if JupyterLab is installed
check_jupyterlab() {
    print_status "Checking for JupyterLab..."

    if command -v jupyter &> /dev/null && jupyter lab --version &> /dev/null; then
        JUPYTER_VERSION=$(jupyter lab --version 2>&1 | head -n1)
        print_success "JupyterLab is installed (version: $JUPYTER_VERSION)"
        return 0
    else
        print_warning "JupyterLab is not installed"
        return 1
    fi
}

# Install JupyterLab
install_jupyterlab() {
    print_status "Installing JupyterLab using $PACKAGE_MANAGER..."

    if install_python_package "jupyterlab"; then
        print_success "JupyterLab installed successfully"
        return 0
    else
        print_error "Failed to install JupyterLab"
        return 1
    fi
}

# Check if JupyterLab extension is installed
check_extension() {
    print_status "Checking for Qiskit Code Assistant JupyterLab extension..."

    if pip list | grep -q "qiskit-code-assistant-jupyterlab"; then
        print_success "JupyterLab extension is installed"
        return 0
    else
        print_warning "JupyterLab extension is not installed"
        return 1
    fi
}

# Install the Qiskit Code Assistant extension
install_extension() {
    print_status "Installing Qiskit Code Assistant JupyterLab extension using $PACKAGE_MANAGER..."

    if install_python_package "qiskit_code_assistant_jupyterlab"; then
        print_success "Extension installed successfully"
        return 0
    else
        print_error "Failed to install extension"
        return 1
    fi
}

# Display summary
display_summary() {
    local model_name=$1

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Setup Complete!                                           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Configuration Summary:${NC}"
    echo -e "  • Ollama URL: ${GREEN}$OLLAMA_URL${NC}"
    echo -e "  • Model: ${GREEN}$model_name${NC}"
    echo -e "  • Telemetry: ${GREEN}Disabled${NC}"
    echo -e "  • Streaming: ${GREEN}Enabled${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Start JupyterLab: ${YELLOW}jupyter lab${NC}"
    echo -e "  2. Open a notebook and start coding with Qiskit"
    echo -e "  3. Use ${YELLOW}Alt + .${NC} to trigger code completion"
    echo -e "  4. Use ${YELLOW}Alt + Tab${NC} to accept suggestions"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  • List models: ${YELLOW}ollama list${NC}"
    echo -e "  • Test model: ${YELLOW}ollama run $model_name${NC}"
    echo -e "  • Check Ollama: ${YELLOW}curl $OLLAMA_URL${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo -e "  • If completions don't work, check the JupyterLab console for errors"
    echo -e "  • Ensure Ollama is running: ${YELLOW}ollama list${NC}"
    echo -e "  • Check the extension settings in JupyterLab Settings Editor"
    echo -e "  • Config file: ${YELLOW}$JUPYTER_CONFIG_FILE${NC}"
    echo ""
}

# Display available models
display_available_models() {
    echo -e "${BLUE}Available Models:${NC}"
    echo -e "  1. ${GREEN}qwen2.5-coder-14b${NC} (Default, Recommended) - Best for code, 14B parameters"
    echo -e "     Command: ${YELLOW}hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF${NC}"
    echo ""
    echo -e "  2. ${GREEN}mistral-small-24b${NC} - Highest quality, 24B parameters (requires 24GB+ RAM)"
    echo -e "     Command: ${YELLOW}hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF${NC}"
    echo ""
    echo -e "  3. ${YELLOW}granite-3.3-8b${NC} - Lightweight fallback, 8B parameters (limited RAM only)"
    echo -e "     Command: ${YELLOW}hf.co/Qiskit/granite-3.3-8b-qiskit-GGUF${NC}"
    echo ""
}

# Main installation flow
main() {
    # Show help if requested
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        echo "Qiskit Code Assistant - Local Setup Script"
        echo ""
        echo "Usage: bash setup_local.sh [model_name]"
        echo ""
        display_available_models
        echo "Example:"
        echo "  bash setup_local.sh"
        echo "  bash setup_local.sh hf.co/Qiskit/qwen2.5-coder-14b-qiskit-GGUF"
        echo ""
        exit 0
    fi

    # Show available models
    if [[ "$1" == "--list-models" ]]; then
        display_available_models
        exit 0
    fi

    detect_os
    detect_package_manager

    # Check and install JupyterLab if needed
    jupyterlab_installed=true
    if ! check_jupyterlab; then
        echo ""
        read -p "$(echo -e ${YELLOW}Would you like to install JupyterLab now? [Y/n]: ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            if ! install_jupyterlab; then
                print_error "Cannot proceed without JupyterLab. Please install it manually and run this script again."
                exit 1
            fi
        else
            jupyterlab_installed=false
            print_warning "Skipping JupyterLab installation. You'll need to install it manually: pip install jupyterlab"
        fi
    fi

    # Check and install extension if needed
    extension_installed=true
    if ! check_extension; then
        echo ""
        read -p "$(echo -e ${YELLOW}Would you like to install the Qiskit Code Assistant extension now? [Y/n]: ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            if ! install_extension; then
                extension_installed=false
                print_warning "Extension installation failed. You can install it manually later: pip install qiskit_code_assistant_jupyterlab"
            fi
        else
            extension_installed=false
            print_warning "Skipping extension installation. You'll need to install it manually: pip install qiskit_code_assistant_jupyterlab"
        fi
    fi

    install_ollama
    start_ollama

    model_name=$(setup_model)
    configure_jupyterlab "$model_name"

    display_summary "$model_name"

    if [ "$jupyterlab_installed" = false ]; then
        echo -e "${YELLOW}⚠ JupyterLab is not installed. Install it with: pip install jupyterlab${NC}"
        echo ""
    fi

    if [ "$extension_installed" = false ]; then
        echo -e "${YELLOW}⚠ Qiskit Code Assistant extension is not installed. Install it with: pip install qiskit_code_assistant_jupyterlab${NC}"
        echo ""
    fi
}

# Run main function
main "$@"
