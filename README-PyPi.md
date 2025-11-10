# Qiskit Code Assistant (Beta)

> The Qiskit Code Assistant is a beta release, subject to change.

Write and optimize Qiskit code with a generative AI code assistant.

---

Increase quantum computing developer productivity and learn best practices for Qiskit and IBM Quantum Platform services with Qiskit Code Assistant!

---

Make programming quantum computers even easier with Qiskit Code Assistant, a generative AI code assistant. Trained with millions of text tokens from Qiskit SDK v2.x, years of Qiskit code examples, and IBM Quantum features, Qiskit Code Assistant accelerates your quantum development workflow by offering LLM-generated suggestions based on [Mistral-Small-3.2-24B-Instruct-2506](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) that incorporate the latest features and functionalities from Qiskit and IBM Quantum.

Qiskit is the open-source quantum SDK preferred by 69% of respondents to the Unitary Fund's Open Source Software Survey, with nearly 600,000 registered users to date. Now you can get the performance and stability of the Qiskit SDK with the added efficiency of Qiskit Code Assistant to streamline your workflow and optimize your quantum computing programs.

## Features

- Accelerate Qiskit code generation by leveraging generative AI based on the `mistral-small-3.2-24b-qiskit` model
- Use abstract and specific prompts to generate recommendations
- Manage code changes by reviewing, accepting, and rejecting suggestions
- Supports Python code files

## Learn the best ways to use Qiskit and IBM Quantum Platform services

Improve your Qiskit code by reviewing, browsing, and accepting model-generated code suggestions.

### Use abstract prompts to get started

Provide abstract prompts to Qiskit Code Assistant using `#comments`. Type `Alt .`, `Alt \` or `Tab` following a `#comment` to obtain syntactically correct and contextually relevant content (up to 60 tokens) suited to your desired task.

![inline complete example](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/raw/main/docs/images/inline-complete.png)

### Use specific prompts for streamlined code completion

Use `Alt .`, `Alt \` or `Tab` with code to obtain specific model-generated suggestions for code completion based on semantic analysis of source code. Review code recommendations before accepting.

## Get started

You can use Qiskit Code Assistant in two ways:

### Option 1: IBM Quantum Cloud (Recommended)

Requires an IBM Quantum Premium Plan account for the best experience.

#### Obtain your IBM Quantum Platform API token

Open the [IBM Quantum Platform](https://quantum.cloud.ibm.com/) in your browser and log in with your IBM Quantum Cloud account. After logging in, an IBM Quantum API token is displayed on the upper right side of the web page.

#### Set the API token in the JupyterLab extension

When you first open Jupyterlab in a new window or tab you may see that the status bar
is highlighted orange, this shows that the service is not reachable.

![statusbar warning](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/raw/main/docs/images/statusbar-no-model.png)

If you click the status bar or try to run the completer a dialog will display asking
for your API token, paste the token copied above here.

![token dialog](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/raw/main/docs/images/enter-token.png)

You can also search for "Qiskit" in the command palette (`Alt Shift C`) to enter or
update your API token.

In addition if the enviroment variable `QISKIT_IBM_TOKEN` is set or the Qiskit
configuration file `~/.qiskit/qiskit-ibm.json` exists then the API token will be
populated at application start. If an API token is entered via the extension it will be
stored in `~/.qiskit/qiskit-ibm.json` under a new config named `qiskit-code-assistant`

#### Accept the model disclaimer/EULA

By default, the model you will use is `mistral-small-3.2-24b-qiskit`. It will appear in the Model Picker in the bottom of the status bar.

The first time you use the `mistral-small-3.2-24b-qiskit` model, a model disclaimer/EULA will appear with information about the model and links to documentation and the model's license. It will also list some restrictions that you should be aware of when using the model, including a restriction against using proprietary code. Clicking `Accept` will enable the new model during code generation.

### Option 2: Local Setup (For Non-Premium Users)

If you don't have an IBM Quantum Premium Plan account, you can run the Qiskit Code Assistant entirely on your local machine using open-source models.

#### Quick Setup (One Command)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Qiskit/qiskit-code-assistant-jupyterlab/main/setup_local.sh)
```

Or if you cloned the repository:

```bash
bash setup_local.sh
```

For automated/CI setups, use non-interactive mode:

```bash
bash setup_local.sh --non-interactive
# Or: bash setup_local.sh -y
```

#### What the script does

- Detects and uses `uv` for faster installations (if available)
- Checks and optionally installs JupyterLab (if needed)
- Always upgrades the extension to the latest version
- Installs and configures Ollama (local LLM server)
- Downloads the Qwen2.5-Coder 14B model optimized for Qiskit (~9GB)
- Configures optimal model parameters
- Sets up JupyterLab extension automatically

#### Requirements

- **Operating System**: macOS, Linux, or Windows (via Git Bash or WSL)
- **Python**: 3.8+ with pip installed
- **RAM**: 16GB+ recommended (8GB+ for lighter models)
- **Disk Space**: ~5-20GB depending on model size

#### Available Models

The setup script supports multiple models. By default, it uses **Qwen2.5-Coder 14B** which offers the best quality for code generation.

| Model                           | Size  | Quality       | RAM Required |
| ------------------------------- | ----- | ------------- | ------------ |
| **Qwen2.5-Coder 14B** (Default) | ~9GB  | Best for code | 16GB+        |
| Mistral Small 24B               | ~15GB | Most recent   | 24GB+        |
| Granite 3.3 8B                  | ~5GB  | Lightweight   | 8GB+         |

All models are trained on **Qiskit 2.0+** and optimized for quantum computing code assistance.

For detailed instructions, see the [Local Setup Guide](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab#local-setup).

## Using the Extension

### Generate code suggestions

Once you've accepted the model disclaimer/EULA, you can open a new file and start typing. If you type `Alt .`, some faded text should appear with model-generated suggestions.

### Review and accept/reject code suggestions

Type `Alt Tab` or `Alt END` to accept the model-generated suggestion, or type `Esc` to cancel/reject the model-generated suggestion.

### Using the Inline Completer

The inline completer can be triggered using the following key strokes.

- `Alt .` or `Alt \` will run the completer at the current cursor location
- `Alt [` and `Alt ]` can be used to cycle through the list of suggestions if there are
  more than one
- `Alt Tab` or `Alt END` will "accept" the suggested code and insert it at the current
  cursor location

In addition, once the completer runs you can use the buttons on the inline completer
widget to cycle or accept

![inline complete example](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/raw/main/docs/images/inline-complete.png)

### Using the Code Completer

Jupyterlab also includes a traditional completer than displays suggestion in a context
menu rather than inline. This completer can be triggered using `Tab` to run and display
the context menu.

The context menu will include suggestions from the default completer in addition to the
Qiskit Code Assistant suggestions. The context menu also sanitizes and trims the
suggestions, making it less useful for see the code suggestion before inserting it.

![tab complete example](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/raw/main/docs/images/tab-complete.png)

### Jupyterlab Settings

There are a few settings we recommend to edit in your user settings.

1. Inline Completer `showWidget` can be set to `always` in order to always show the
   inline completer widget to cycle through and select a completion item

2. Code Completion `providerTimeout` can be increased, our suggested value is `15000` or
   15 seconds. This is 1 second by default and the Qiskit Code Assistant API rarely returns
   within 1 second. This setting only apply the the standard completer that is invoked with
   `Tab`, the inline completer has a default of 15 seconds.

3. If you want to change the instance of the Qiskit Code Assistant Service that the
   extension should use you can edit the Qiskit Code Assistant setting `serviceUrl`.
   This can also be set to any service exposing LLMs using OpenAI-compatible API endpoints.

4. Keyboard shortcuts can be changed by searching for `completer` in the Keyboard Shortcuts
   settings and adding new shortcuts for the relevant commands.

5. Telemetry can be disabled by unchecking the `enableTelemetry` setting.

   > **NOTE**: The telemetry does not collect your code nor the suggested code completions.
   > What is collected is whether a code suggestion was accepted or dismissed.

6. Response streaming can be enabled by checking the `enableStreaming` setting.

## Terms of use

- [End User License Agreement (EULA)](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/blob/main/docs/EULA.md) acceptance required before starting to use the model acceptance required before starting to use the model
- Terms of use: [https://quantum.ibm.com/terms](https://quantum.ibm.com/terms)
- Privacy policy: [https://quantum.ibm.com/terms/privacy](https://quantum.ibm.com/terms/privacy)
- Cloud Services Agreement [https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en)
- IBM Cloud Service Description [https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en)
