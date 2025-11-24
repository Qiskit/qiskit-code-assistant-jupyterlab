# Getting Started with the Qiskit Code Assistant

> **Looking to run locally?** Check out [LOCAL_SETUP.md](LOCAL_SETUP.md) for a free, private, offline setup using your own computer!

This guide covers setting up the Qiskit Code Assistant through IBM Quantum Cloud Platform. For local deployment options, see [LOCAL_SETUP.md](LOCAL_SETUP.md).

## Requirements

- JupyterLab >= 4.3.0
- Access to either:
  - An IBM Quantum premium plan user account
  - A local LLM service (see [LOCAL_SETUP.md](LOCAL_SETUP.md))
  - A service exposing LLMs using OpenAI-compatible API endpoints

## Install

To install the extension, execute:

```bash
pip install qiskit_code_assistant_jupyterlab
```

To install the extension using a GitHub release, download the whl file from the [latest release](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/releases), then execute:

```bash
pip install PATH/TO/DOWNLOADED/FILE.whl
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall qiskit_code_assistant_jupyterlab
```

## Using the Qiskit Code Assistant through IBM Quantum Cloud Platform (recommended)

### IBM Quantum API Token

To make calls to the service API the extension requires an IBM Quantum API token.

#### Getting your API token

Open the [IBM Quantum website](https://quantum.cloud.ibm.com/) in your browser and login with
your IBM Quantum Cloud account.
After logging in, an API token is displayed on the upper right side of the webpage.

![IBM Quantum API Key](docs/images/api-key.png)

#### Submitting your API token to the extension

When you first open Jupyterlab in a new window or tab you may see that the status bar
is highlighted orange, this shows that the service is not reachable.

![statusbar warning](docs/images/statusbar-no-model.png)

If you click the status bar or try to run the completer a dialog will display asking
for your API token, paste the token copied above here.

![token dialog](docs/images/enter-token.png)

You can also search for "Qiskit" in the command palette (`Alt Shift C`) to enter or
update your API token.

Once you've submitted a valid API key then the model select dialog will show, you can
open this dialog again to change models by clicking the statusbar.

![select a model](docs/images/select-model.png)

In addition if the enviroment variable `QISKIT_IBM_TOKEN` is set or the Qiskit
configuration file `~/.qiskit/qiskit-ibm.json` exists then the API token will be
populated at application start. If an API token is entered via the extension it will be
stored in `~/.qiskit/qiskit-ibm.json` under a new config named `qiskit-code-assistant`

### Using the Inline Completer

The inline completer can be triggered using the following key strokes.

- `Alt .` or `Alt \` will run the completer at the current cursor location
- `Alt [` and `Alt ]` can be used to cycle through the list of suggestions if there are
  more than one
- `Alt Tab` or `Alt END` will "accept" the suggested code and insert it at the current
  cursor location

In addition, once the completer runs you can use the buttons on the inline completer
widget to cycle or accept

![inline complete example](docs/images/inline-complete.png)

> NOTE: The service can sometime take a few seconds to retrun a suggestion, you can see
> when the service is working by checking the status bar

![working](docs/images/statusbar-working.png)

### Using the Code Completer

Jupyterlab also includes a traditional completer than displays suggestion in a context
menu rather than inline. This completer can be triggered using `Tab` to run and display
the context menu.

The context menu will include suggestions from the default completer in addition to the
Qiskit Code Assistant suggestions. The context menu also sanitizes and trims the
suggestions, making it less useful for see the code suggestion before inserting it.

![tab complete example](docs/images/tab-complete.png)

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

### Code Migration Feature

The Qiskit Code Assistant includes a code migration feature that helps you modernize legacy Qiskit code:

#### How to Use

1. **Migrate a Single Cell**:
   - Locate the ✨ sparkle button in a code cell's toolbar
   - Click the sparkle button to start migration
   - Confirm the migration dialog
   - The cell content will be updated with migrated code

2. **Migrate Entire Notebook**:
   - Click the ✨ sparkle button in the notebook toolbar (located next to the cell type dropdown)
   - Confirm the migration dialog
   - All code cells will be migrated automatically
   - Markdown cells are preserved unchanged

#### Features

- **Smart Detection**: Automatically identifies code that needs migration
- **Real-time Streaming**: When streaming is enabled, you'll see the migration progress in real-time
- **Safe Operations**: Always shows a confirmation dialog before making changes
- **Selective Processing**: Only processes code cells; markdown cells are skipped
- **Validation**: Checks for empty cells and invalid inputs
- **Error Handling**: Clear error messages guide you if something goes wrong

#### Settings

The migration feature respects the `enableStreaming` setting:

- **Streaming Enabled**: See migration results appear progressively as they're generated
- **Streaming Disabled**: Migration completes before updating cells (better for slower connections)

#### Best Practices

- Always review migrated code before running it
- Test migrated code in a copy of your notebook first
- Keep a backup of your original notebooks
- Run migration on one cell at a time for large, complex cells

## Troubleshooting

If you are seeing the frontend extension, but it is not working, check that the server
extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing the frontend
extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

**Note**: The migration feature is still under development and its gated to a few set of testers. When it's fully released, it will be open for any user which is part of a IBM Quantum Premium plan.