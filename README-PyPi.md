# Qiskit Code Assistant (Beta)

> This experimental feature is only available, as of today, to IBM Quantum premium users.
> If you are not part of the IBM Quantum premium plan, you can still install this extension; however you will not be able to use the assistant.
> The Qiskit Code Assistant is a beta release, subject to change.

Write and optimize Qiskit code with a generative AI code assistant.

---

Increase quantum computing developer productivity and learn best practices for Qiskit and IBM Quantum Platform services with Qiskit Code Assistant!

---

Make programming quantum computers even easier with Qiskit Code Assistant, a generative AI code assistant. Trained with approximately 370 million text tokens from Qiskit SDK v1.x, years of Qiskit code examples, and IBM Quantum features, Qiskit Code Assistant accelerates your quantum development workflow by offering LLM-generated suggestions based on [IBM Granite 8B Code](https://www.ibm.com/products/watsonx-ai/foundation-models) that incorporate the latest features and functionalities from IBM. And soon, Qiskit Code Assistant will be able to be used alongside Qiskit patterns building blocks for reusable code and workflow simplification.

Qiskit is the open-source quantum SDK preferred by 69% of respondents to the Unitary Fund's Open Source Software Survey, with nearly 600,000 registered users to date. Now you can get the performance and stability of the Qiskit SDK with the added efficiency of Qiskit Code Assistant to streamline your workflow and optimize your quantum computing programs.

## Features

- Accelerate Qiskit code generation by leveraging generative AI based on the `granite-8b-qiskit` model
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

### Obtain your IBM Quantum Platform API token

Open the [IBM Quantum Platform](https://quantum.ibm.com/) in your browser and log in with your IBM Quantum account. After logging in, an IBM Quantum API token is displayed on the upper right side of the web page.

### Set the API token in the JupyterLab extension

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

### Accept the model disclaimer/EULA

By default, the model you will use is `granite-8b-qiskit`. It will appear in the Model Picker in the bottom of the status bar.

The first time you use the `granite-8b-qiskit` model, a model disclaimer/EULA will appear with information about the model and links to documentation and the model's license. It will also list some restrictions that you should be aware of when using the model, including a restriction against using proprietary code. Clicking `Accept` will enable the new model during code generation.

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

2. Code Completion `providerTimeout` can be increased, our suggested value is `10000` or
   10 seconds. This is 1 second by default and the Qiskit Code Assistant API rarely returns
   within 1 second. This setting only apply the the standard completer that is invoked with
   `Tab`, the inline completer has a default of 10 seconds.

3. If you want to change the instance of the Qiskit Code Assistant Service that the
   extension should use you can edit the Qiskit Code Assistant setting `serviceUrl`

4. Keyboard shortcuts can be changed by searching for `completer` in the Keyboard Shortcuts
   settings and adding new shortcuts for the relevant commands.

## Terms of use

- [End User License Agreement (EULA)](https://github.com/Qiskit/qiskit-code-assistant-jupyterlab/blob/main/docs/EULA.md) acceptance required before starting to use the model acceptance required before starting to use the model
- Terms of use: [https://quantum.ibm.com/terms](https://quantum.ibm.com/terms)
- Privacy policy: [https://quantum.ibm.com/terms/privacy](https://quantum.ibm.com/terms/privacy)
- Cloud Services Agreement [https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=Z126-6304&cc=us&lc=en)
- IBM Cloud Service Description [https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en](https://www.ibm.com/support/customer/csol/terms/?id=i126-6605&lc=en)
