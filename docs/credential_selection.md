# Managing Multiple IBM Quantum Credentials

If you have multiple IBM Quantum accounts in your `~/.qiskit/qiskit-ibm.json` file, Qiskit Code Assistant now helps you choose which one to use.

## What's New

- **Automatic credential discovery** - The extension detects when you have multiple accounts
- **Easy selection** - Choose your preferred account with a simple dropdown
- **Persistent choice** - Your selection is remembered across JupyterLab sessions
- **Easy verification** - Check which credential is active anytime through the command palette

## How It Works

### First Time Setup

When you first open JupyterLab with multiple credentials:

1. A dialog appears: "Multiple IBM Quantum Credentials Found"
2. Click "Select Credential"
3. Choose your preferred account from the dropdown
4. Your choice is saved automatically

**That's it!** You won't see this prompt again unless you want to change credentials.

### Switching Credentials

To switch to a different credential anytime:

1. Open the Command Palette (`Cmd+Shift+C` on Mac, `Ctrl+Shift+C` on Windows/Linux)
2. Type "Select credential"
3. Choose "Qiskit Code Assistant: Select credential"
4. Choose how you want to authenticate:
   - **Select Credential** - Pick from credentials in `~/.qiskit/qiskit-ibm.json`
   - **Enter Token Manually** - Enter a token directly
5. Complete your selection

### Clearing Your Selection

To reset your credential selection and choose a different one:

1. Open the Command Palette (`Cmd+Shift+C` on Mac, `Ctrl+Shift+C` on Windows/Linux)
2. Type "Clear credential"
3. Choose "Qiskit Code Assistant: Clear credential selection"
4. Confirm the action
5. You'll immediately see the credential selection dialog to choose a new one

This removes your saved preference file (including "Don't Ask Again" flag) and prompts you to select a credential right away.

### Checking Active Credential

You can check which credential is currently active by running the "Qiskit Code Assistant: Select credential" command from the Command Palette. The dropdown will show your currently selected credential marked with "(current)".

## Your Credentials File

Your credentials are stored in: `~/.qiskit/qiskit-ibm.json`

You can name your credentials **anything you want**. For example:

```json
{
  "work-account": {
    "token": "your-token-here",
    "url": "https://auth.quantum-computing.ibm.com/api"
  },
  "personal-account": {
    "token": "your-other-token",
    "url": "https://auth.quantum-computing.ibm.com/api"
  },
  "client-demo": {
    "token": "demo-token",
    "url": "https://auth.quantum-computing.ibm.com/api"
  }
}
```

## Environment Variable Override

If you set `QISKIT_IBM_TOKEN` as an environment variable, it will **always** be used instead of credentials from the file.

When this happens:
- If you try to select a credential, you'll see a warning explaining the override
- To use file-based credentials, unset the environment variable and restart JupyterLab

## Manual Token Entry

If you use "Set IBM Quantum API token" from the command palette:
- Your token is saved as "qiskit-code-assistant" in the credentials file
- This becomes your selected credential automatically

## Troubleshooting

**Q: I have multiple credentials but don't see the selection dialog**

A: The extension may have already auto-selected one. To change it:
- Use Command Palette → "Qiskit Code Assistant: Select credential"

**Q: My selection keeps resetting**

A: Check if you have `QISKIT_IBM_TOKEN` environment variable set. If so, it overrides your selection.

**Q: I want to use a specific account instead of the environment variable**

A: Unset the `QISKIT_IBM_TOKEN` environment variable and restart JupyterLab, then select your preferred credential.

**Q: Can I have credentials with spaces or special characters in names?**

A: Yes! You can name your credentials anything. Just make sure the name is a valid JSON key.

## For Developers

Your credential selection is stored in: `~/.qiskit/qiskit-code-assistant-prefs.json`

This file is created automatically and contains:
```json
{
  "selected_credential": "your-chosen-credential-name"
}
```

You can delete this file to reset your selection.
