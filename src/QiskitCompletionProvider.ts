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
  CompletionHandler,
  ICompletionContext,
  ICompletionProvider,
  IInlineCompletionContext,
  IInlineCompletionItem,
  IInlineCompletionList,
  IInlineCompletionProvider,
  InlineCompletionTriggerKind
} from '@jupyterlab/completer';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';

import { postModelPromptAccept } from './service/api';
import { autoComplete } from './service/autocomplete';
import { qiskitIcon } from './utils/icons';

function getInputText(text: string, widget: Widget): string {
  const cellsContents: string[] = [];

  if (widget instanceof NotebookPanel) {
    const currentCellIndex: number = widget.content.activeCellIndex;
    const cells = widget.content.widgets;

    for (let i = 0; i < currentCellIndex; i++) {
      if (['code', 'markdown'].includes(cells[i].model.type)) {
        const content = cells[i].model.toJSON().source;

        cellsContents.push(
          Array.isArray(content) ? content.join('\n') : content
        );
      }
    }

    cellsContents.push(text);

    return cellsContents.join('\n');
  }

  return text;
}
export class QiskitCompletionProvider implements ICompletionProvider {
  readonly identifier: string = 'QiskitCodeAssistant:completer';
  readonly rank: number = 1100;

  settings: ISettingRegistry.ISettings;
  prompt_id: string = '';

  constructor(options: { settings: ISettingRegistry.ISettings }) {
    this.settings = options.settings;
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const text = getInputText(request.text, context.widget);

    return autoComplete(text).then(results => {
      this.prompt_id = results.prompt_id;
      return {
        start: request.offset,
        end: request.offset,
        items: results.items.map(
          (item: string): CompletionHandler.ICompletionItem => {
            return {
              label: item.trim(),
              insertText: item,
              icon: qiskitIcon
            };
          }
        )
      };
    });
  }

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    // Only fetch when enabled in settings
    return this.settings.composite['enableCompleter'] as boolean;
  }

  accept() {
    if (this.prompt_id) {
      postModelPromptAccept(this.prompt_id);
    }
  }
}

export class QiskitInlineCompletionProvider
  implements IInlineCompletionProvider
{
  readonly icon: LabIcon.ILabIcon = qiskitIcon;
  readonly identifier: string = 'qiskit-code-assistant-inline-completer';
  readonly name: string = 'Qiskit Code Assistant';

  prompt_id: string = '';
  schema: ISettingRegistry.IProperty = {
    default: {
      enabled: true,
      timeout: 10000
    }
  };

  async fetch(
    request: CompletionHandler.IRequest,
    context: IInlineCompletionContext
  ): Promise<IInlineCompletionList> {
    if (context.triggerKind === InlineCompletionTriggerKind.Automatic) {
      // Don't call the API when fetch is not manually triggered
      return { items: [] };
    }

    const text = getInputText(request.text, context.widget);

    return autoComplete(text).then(results => {
      this.prompt_id = results.prompt_id;
      return {
        items: results.items.map((item: string): IInlineCompletionItem => {
          return { insertText: item };
        })
      };
    });
  }

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    // Always fetch, any filtering is handled by the service
    return true;
  }

  accept() {
    if (this.prompt_id) {
      postModelPromptAccept(this.prompt_id);
    }
  }
}
