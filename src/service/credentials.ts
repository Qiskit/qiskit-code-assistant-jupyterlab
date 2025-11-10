/*
 * Copyright 2025 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Dialog, showDialog, InputDialog } from '@jupyterlab/apputils';
import {
  getCredentials,
  postSelectCredential,
  deleteClearCredentialSelection,
  putCredentialFlags
} from './api';
import { refreshModelsList } from './modelHandler';
import { updateAPIToken } from './token';

/**
 * Proactively check for multiple credentials on startup and prompt user to select
 * This is called during extension initialization.
 *
 * Similar to VS Code implementation, provides three options:
 * 1. Select Credential - Choose from available credentials
 * 2. Enter Token Manually - Enter a token directly
 * 3. Don't Ask Again - Never show this prompt
 */
export async function checkAndPromptForCredentialSelection(): Promise<boolean> {
  try {
    const credentialsData = await getCredentials();
    const {
      credentials,
      selected_credential,
      using_env_var,
      never_prompt,
      has_prompted
    } = credentialsData;

    // Skip if user chose "Don't Ask Again" globally
    if (never_prompt) {
      console.debug(
        'User chose "Don\'t Ask Again", skipping credential prompt'
      );
      return false;
    }

    // Skip if already prompted in this session
    if (has_prompted) {
      console.debug('Already prompted in this session, skipping');
      return false;
    }

    // Skip if using environment variable
    if (using_env_var) {
      console.debug(
        'Using QISKIT_IBM_TOKEN environment variable, skipping credential selection'
      );
      return false;
    }

    // Skip if no credentials
    if (credentials.length === 0) {
      console.debug('No credentials found in qiskit-ibm.json');
      return false;
    }

    // Skip if only one credential (it will be auto-selected)
    if (credentials.length === 1) {
      console.debug('Only one credential available, auto-selecting');
      return false;
    }

    // Skip if a credential is already selected (from previous session)
    if (selected_credential) {
      console.debug(
        `Credential already selected: ${selected_credential}, skipping prompt`
      );
      return false;
    }

    // Multiple credentials and none selected - proactively prompt user
    console.debug(
      `Found ${credentials.length} credentials, prompting user to select`
    );

    const result = await showDialog({
      title: 'Multiple IBM Quantum Credentials Found',
      body: `Qiskit Code Assistant found ${credentials.length} IBM Quantum credentials. Would you like to choose which one to use?`,
      buttons: [
        Dialog.okButton({ label: 'Select Credential' }),
        Dialog.warnButton({ label: 'Enter Token Manually' }),
        Dialog.createButton({ label: "Don't Ask Again" })
      ]
    });

    // Mark that we've prompted (after user responds)
    await putCredentialFlags({ has_prompted: true });

    if (result.button.label === 'Select Credential') {
      // Show credential selection dropdown directly (skip the choice dialog)
      await selectCredential(true);
      return true; // Indicate that credential was selected and models already initialized
    } else if (result.button.label === 'Enter Token Manually') {
      // Show manual token entry dialog
      await updateAPIToken();
      return false;
    } else if (result.button.label === "Don't Ask Again") {
      // Set the never prompt flag
      await putCredentialFlags({ never_prompt: true });
      console.debug('User chose "Don\'t Ask Again"');
      return false;
    }

    // If dismissed, do nothing (will use automatic selection)
    return false;
  } catch (error) {
    // Silently fail - don't interrupt extension activation
    console.error('Error in proactive credential selection:', error);
    return false;
  }
}

/**
 * Check if multiple credentials exist and prompt user to select one
 * This is called when authentication fails or user manually triggers selection
 */
export async function checkAndSelectCredential(): Promise<void> {
  try {
    const credentialsData = await getCredentials();
    const { credentials } = credentialsData;

    if (credentials.length === 0) {
      console.debug('No credentials found in qiskit-ibm.json');
      return;
    }

    if (credentials.length === 1) {
      // Only one credential, auto-select it if not already selected
      if (!credentialsData.selected_credential) {
        await postSelectCredential(credentials[0].name);
      }
      return;
    }

    // Multiple credentials exist - show selection dialog
    await selectCredential();
  } catch (error) {
    console.error('Error checking credentials:', error);
  }
}

/**
 * Show dialog to select a credential from available options
 * @param skipChoiceDialog - If true, skip the "choose how to authenticate" dialog and go directly to credential selection
 */
export async function selectCredential(
  skipChoiceDialog = false
): Promise<void> {
  try {
    const credentialsData = await getCredentials();
    const { credentials, selected_credential, using_env_var } = credentialsData;

    // Warn if environment variable is overriding credential selection
    if (using_env_var) {
      await showDialog({
        title: 'Environment Variable Override',
        body: 'The QISKIT_IBM_TOKEN environment variable is currently set and will override any credential selection. To use credentials from ~/.qiskit/qiskit-ibm.json, unset the QISKIT_IBM_TOKEN environment variable and restart JupyterLab.',
        buttons: [Dialog.okButton({ label: 'Understood' })]
      });
      return;
    }

    if (credentials.length === 0) {
      await showDialog({
        title: 'No Credentials Found',
        body: 'No credentials found in ~/.qiskit/qiskit-ibm.json. Please add your IBM Quantum credentials to the file or use the "Set IBM Quantum API token" command.',
        buttons: [Dialog.okButton()]
      });
      return;
    }

    // If skipChoiceDialog is false (manual command palette invocation), ask user how to authenticate
    if (!skipChoiceDialog) {
      const choiceResult = await showDialog({
        title: 'Select IBM Quantum Credential',
        body: 'Choose how you want to authenticate:',
        buttons: [
          Dialog.okButton({ label: 'Select Credential' }),
          Dialog.warnButton({ label: 'Enter Token Manually' }),
          Dialog.cancelButton()
        ]
      });

      if (choiceResult.button.label === 'Enter Token Manually') {
        // Show manual token entry dialog
        await updateAPIToken();
        return;
      }

      if (!choiceResult.button.accept) {
        // User cancelled
        return;
      }
    }

    // Show credential dropdown
    // Create items list with indication of currently selected credential
    const items = credentials.map(cred => {
      const isSelected = cred.name === selected_credential;
      return isSelected ? `${cred.name} (current)` : cred.name;
    });

    const currentIndex = credentials.findIndex(
      cred => cred.name === selected_credential
    );

    const result = await InputDialog.getItem({
      title: 'Select IBM Quantum Credential',
      items: items,
      current: currentIndex >= 0 ? currentIndex : 0,
      label: 'Choose which credential from ~/.qiskit/qiskit-ibm.json to use:'
    });

    if (result.button.accept && result.value) {
      // Extract credential name (remove "(current)" suffix if present)
      const selectedName = result.value.replace(' (current)', '');
      const selectedCredential = credentials.find(
        cred => cred.name === selectedName
      );

      if (selectedCredential) {
        // Only call API and refresh if credential actually changed
        if (selectedCredential.name !== selected_credential) {
          await postSelectCredential(selectedCredential.name);
          // Refresh models list with new credential (validates the credential)
          await refreshModelsList();
        } else {
          console.debug('Selected same credential, no action needed');
        }
      }
    }
  } catch (error) {
    console.error('Error selecting credential:', error);
    throw error;
  }
}

/**
 * Clear the credential selection and all state flags (resets to default behavior)
 * Similar to VS Code's resetCredentialSelectionCommand
 */
export async function clearCredentialSelection(): Promise<void> {
  try {
    const credentialsData = await getCredentials();
    const { selected_credential, using_env_var, never_prompt, has_prompted } =
      credentialsData;

    // Warn if environment variable is set
    if (using_env_var) {
      await showDialog({
        title: 'Environment Variable Set',
        body: 'The QISKIT_IBM_TOKEN environment variable is currently set and takes precedence over credential selection. There is no saved credential selection to clear.',
        buttons: [Dialog.okButton({ label: 'OK' })]
      });
      return;
    }

    // Check if there's anything to clear
    if (!selected_credential && !never_prompt && !has_prompted) {
      await showDialog({
        title: 'Nothing to Clear',
        body: 'There is no credential selection or preferences saved. The extension is already using default behavior.',
        buttons: [Dialog.okButton({ label: 'OK' })]
      });
      return;
    }

    // Confirm with user using a warning dialog
    const result = await showDialog({
      title: 'Reset Credential Selection',
      body: "This will reset your credential selection and clear all related preferences. You'll be prompted to choose a new credential immediately.\n\nAre you sure?",
      buttons: [
        Dialog.cancelButton({ label: 'Cancel' }),
        Dialog.warnButton({ label: 'Reset' })
      ]
    });

    if (result.button.accept) {
      await deleteClearCredentialSelection();

      // Immediately prompt user to select a new credential
      await selectCredential();
    }
  } catch (error) {
    console.error('Error clearing credential selection:', error);
    throw error;
  }
}
