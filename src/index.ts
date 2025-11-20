/*
 * Copyright 2024 IBM Corporation
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

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, ToolbarButton } from '@jupyterlab/apputils';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
  INotebookModel,
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStatusBar } from '@jupyterlab/statusbar';

import { StatusBarWidget } from './StatusBarWidget';
import {
  lastPrompt,
  QiskitCompletionProvider,
  QiskitInlineCompletionProvider,
  wipeLastPrompt
} from './QiskitCompletionProvider';
import { postServiceUrl } from './service/api';
import {
  selectCredential,
  checkAndPromptForCredentialSelection,
  clearCredentialSelection
} from './service/credentials';
import { getFeedbackStatusBarWidget, getFeedback } from './service/feedback';
import { refreshModelsList } from './service/modelHandler';
import { updateAPIToken } from './service/token';
import { feedbackIcon, migrationIcon } from './utils/icons';
import { migrateNotebook, migrateNotebookCell } from './service/migration';

const EXTENSION_ID = 'qiskit-code-assistant-jupyterlab';

namespace CommandIDs {
  export const acceptInline = 'inline-completer:accept';
  export const selectCompleterNotebook = 'completer:select-notebook';
  export const selectCompleterFile = 'completer:select-file';
  export const updateApiToken = 'qiskit-code-assistant:set-api-token';
  export const selectCredential = 'qiskit-code-assistant:select-credential';
  export const clearCredential = 'qiskit-code-assistant:clear-credential';
  export const promptFeedback = 'qiskit-code-assistant:prompt-feedback';
  export const migrateCode = 'qiskit-code-assistant:migrate-code';
}

/**
 * Initialization data for the qiskit-code-assistant-jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: EXTENSION_ID + ':plugin',
  description: 'AI Autocomplete JupyterLab extension for Qiskit Code Assistant',
  autoStart: true,
  requires: [
    ICompletionProviderManager,
    INotebookTracker,
    ICommandPalette,
    ISettingRegistry,
    IStatusBar
  ],
  activate: async (
    app: JupyterFrontEnd,
    completionProviderManager: ICompletionProviderManager,
    notebookTracker: INotebookTracker,
    palette: ICommandPalette,
    settingRegistry: ISettingRegistry,
    statusBar: IStatusBar
  ) => {
    console.debug('JupyterLab extension ' + EXTENSION_ID + ' is activated!');

    const settings = await settingRegistry.load(plugin.id);
    console.debug(EXTENSION_ID + ' settings loaded:', settings.composite);

    let is_openai = false;

    postServiceUrl(settings.composite['serviceUrl'] as string).then(
      response => {
        is_openai = response.is_openai;
        wipeLastPrompt();
      }
    );
    settings.changed.connect(() =>
      postServiceUrl(settings.composite['serviceUrl'] as string).then(
        response => {
          is_openai = response.is_openai;
          wipeLastPrompt();
          refreshModelsList();
        }
      )
    );

    const provider = new QiskitCompletionProvider({ settings, app });
    const inlineProvider = new QiskitInlineCompletionProvider({
      settings,
      app
    });
    completionProviderManager.registerProvider(provider);
    completionProviderManager.registerInlineProvider(inlineProvider);

    statusBar.registerStatusItem(EXTENSION_ID + ':feedback', {
      item: getFeedbackStatusBarWidget(),
      align: 'left',
      isActive: () => !is_openai
    });

    const statusBarWidget = new StatusBarWidget();
    statusBar.registerStatusItem(EXTENSION_ID + ':statusbar', {
      item: statusBarWidget,
      align: 'left'
    });

    // Proactively check for multiple credentials and prompt user to select
    // Returns true if user selected a credential (which already called refreshModelsList)
    const credentialWasSelected =
      await checkAndPromptForCredentialSelection().catch(reason => {
        console.debug('Credential selection check skipped:', reason);
        return false;
      });

    // Only refresh models if they weren't already refreshed during credential selection
    if (!credentialWasSelected) {
      await refreshModelsList().catch(reason => {
        console.error('Failed initial load of models list', reason);
      });
    }

    app.commands.addCommand(CommandIDs.promptFeedback, {
      label: 'Give feedback for the Qiskit Code Assistant',
      icon: feedbackIcon,
      execute: () => getFeedback(),
      isEnabled: () => !is_openai && lastPrompt !== undefined,
      isVisible: () =>
        !is_openai &&
        ['code', 'markdown'].includes(
          notebookTracker.activeCell?.model.type || ''
        ) &&
        lastPrompt !== undefined
    });

    app.commands.addCommand(CommandIDs.updateApiToken, {
      label: 'Qiskit Code Assistant: Set IBM Quantum API token',
      execute: () => updateAPIToken()
    });

    app.commands.addCommand(CommandIDs.selectCredential, {
      label: 'Qiskit Code Assistant: Select credential',
      execute: () => selectCredential()
    });

    app.commands.addCommand(CommandIDs.clearCredential, {
      label: 'Qiskit Code Assistant: Clear credential selection',
      execute: () => clearCredentialSelection()
    });

    const streamingEnabled = settings.composite['enableStreaming'] as boolean;

    app.commands.addCommand(CommandIDs.migrateCode, {
      label: 'Migrate Qiskit code in this cell',
      icon: migrationIcon,
      execute: () =>
        migrateNotebookCell(notebookTracker.activeCell, streamingEnabled),
      isEnabled: () => true,
      isVisible: () =>
        ['code'].includes(notebookTracker.activeCell?.model.type || '')
    });

    palette.addItem({
      command: CommandIDs.updateApiToken,
      category: 'Qiskit Code Assistant'
    });

    palette.addItem({
      command: CommandIDs.selectCredential,
      category: 'Qiskit Code Assistant'
    });

    palette.addItem({
      command: CommandIDs.clearCredential,
      category: 'Qiskit Code Assistant'
    });

    completionProviderManager.selected.connect((completer, selection) => {
      if (settings.composite['enableTelemetry'] as boolean) {
        provider.accept(selection.insertText);
      }
    });

    app.commands.commandExecuted.connect((registry, executed) => {
      if (
        executed.id === CommandIDs.acceptInline &&
        (settings.composite['enableTelemetry'] as boolean)
      ) {
        inlineProvider.accept();
      }
    });

    app.docRegistry.addWidgetExtension('Notebook', {
      createNew(
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>
      ) {
        const button = new ToolbarButton({
          label: '',
          onClick: () => {
            migrateNotebook(panel, streamingEnabled);
          },
          tooltip: 'Migrate Qiskit code in the notebook',
          icon: migrationIcon
        });
        // add migrate button before cell type dropdown
        panel.toolbar.insertBefore('cellType', 'migrateCode', button);
      }
    });
  }
};

export default plugin;
