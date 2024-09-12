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
import { ICommandPalette } from '@jupyterlab/apputils';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStatusBar } from '@jupyterlab/statusbar';

import { StatusBarWidget } from './StatusBarWidget';
import {
  QiskitCompletionProvider,
  QiskitInlineCompletionProvider
} from './QiskitCompletionProvider';
import { postServiceUrl } from './service/api';
import { refreshModelsList } from './service/modelHandler';
import { updateAPIToken } from './service/token';

const EXTENSION_ID = 'qiskit-code-assistant-jupyterlab';

namespace CommandIDs {
  export const acceptInline = 'inline-completer:accept';
  export const selectCompleterNotebook = 'completer:select-notebook';
  export const selectCompleterFile = 'completer:select-file';
  export const updateApiToken = 'qiskit-code-assistant:set-api-token';
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
    ICommandPalette,
    ISettingRegistry,
    IStatusBar
  ],
  activate: async (
    app: JupyterFrontEnd,
    completionProviderManager: ICompletionProviderManager,
    palette: ICommandPalette,
    settingRegistry: ISettingRegistry,
    statusBar: IStatusBar
  ) => {
    console.debug('JupyterLab extension ' + EXTENSION_ID + ' is activated!');

    const settings = await settingRegistry.load(plugin.id);
    console.debug(EXTENSION_ID + ' settings loaded:', settings.composite);

    postServiceUrl(settings.composite['serviceUrl'] as string);
    settings.changed.connect(() =>
      postServiceUrl(settings.composite['serviceUrl'] as string)
    );

    const provider = new QiskitCompletionProvider({ settings });
    const inlineProvider = new QiskitInlineCompletionProvider();
    completionProviderManager.registerProvider(provider);
    completionProviderManager.registerInlineProvider(inlineProvider);

    const statusBarWidget = new StatusBarWidget();
    statusBar.registerStatusItem(EXTENSION_ID + ':statusbar', {
      item: statusBarWidget,
      align: 'left'
    });

    await refreshModelsList().catch(reason => {
      console.error('Failed initial load of models list', reason);
    });

    app.commands.addCommand(CommandIDs.updateApiToken, {
      label: 'Qiskit Code Assistant: Set IBM Quantum API token',
      execute: () => updateAPIToken()
    });

    palette.addItem({
      command: CommandIDs.updateApiToken,
      category: 'Qiskit Code Assistant'
    });

    app.commands.commandExecuted.connect((registry, executed) => {
      if (
        executed.id === CommandIDs.selectCompleterFile ||
        executed.id === CommandIDs.selectCompleterNotebook
      ) {
        provider.accept();
      } else if (executed.id === CommandIDs.acceptInline) {
        inlineProvider.accept();
      }
    });
  }
};

export default plugin;
