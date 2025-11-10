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

import { JupyterFrontEnd } from '@jupyterlab/application';
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
import { autoComplete, autoCompleteStreaming } from './service/autocomplete';
import { StatusBarWidget } from './StatusBarWidget';
import { qiskitIcon } from './utils/icons';
import { ICompletionReturn } from './utils/schema';

const FEEDBACK_COMMAND = 'qiskit-code-assistant:prompt-feedback';

export let lastPrompt: ICompletionReturn | undefined = undefined;

export const wipeLastPrompt = () => (lastPrompt = undefined);

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
  app: JupyterFrontEnd;
  prompt_id: string = '';
  results: string[] = [];

  constructor(options: {
    settings: ISettingRegistry.ISettings;
    app: JupyterFrontEnd;
  }) {
    this.settings = options.settings;
    this.app = options.app;
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const text = getInputText(request.text, context.widget);

    return autoComplete(text).then(results => {
      this.prompt_id = results.prompt_id;
      this.results = results.items;
      if (this.prompt_id) {
        lastPrompt = results;
        this.app.commands.notifyCommandChanged(FEEDBACK_COMMAND);
      }
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

  accept(text: string) {
    if (this.prompt_id && this.results.includes(text)) {
      postModelPromptAccept(this.prompt_id);
    }
  }
}

interface IStreamContext {
  generator: AsyncGenerator<ICompletionReturn>;
  abortController: AbortController;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class QiskitInlineCompletionProvider
  implements IInlineCompletionProvider
{
  readonly icon: LabIcon.ILabIcon = qiskitIcon;
  readonly identifier: string = 'qiskit-code-assistant-inline-completer';
  readonly name: string = 'Qiskit Code Assistant';

  settings: ISettingRegistry.ISettings;
  app: JupyterFrontEnd;
  prompt_id: string = '';
  schema: ISettingRegistry.IProperty = {
    default: {
      enabled: true,
      timeout: 15000
    }
  };

  _streamPromises: Map<string, IStreamContext> = new Map();
  private _currentNotebook: NotebookPanel | null = null;
  private _boundKeyDown: (e: KeyboardEvent) => void;
  private _boundFocusOut: (e: FocusEvent) => void;

  constructor(options: {
    settings: ISettingRegistry.ISettings;
    app: JupyterFrontEnd;
  }) {
    this.settings = options.settings;
    this.app = options.app;

    // Bind keyboard handler
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundFocusOut = this._onFocusOut.bind(this);

    // Listen for ESC key to cancel inline completions
    document.addEventListener('keydown', this._boundKeyDown);

    // Listen for focus loss (clicking outside notebook)
    document.addEventListener('focusout', this._boundFocusOut);

    // Listen for shell changes (switching between widgets)
    if (this.app.shell?.currentChanged) {
      this.app.shell.currentChanged.connect(this._onShellChanged, this);
    }

    // Set up notebook listener for current widget if it's a notebook
    const currentWidget = this.app.shell.currentWidget;
    if (currentWidget instanceof NotebookPanel) {
      this._setupNotebookListeners(currentWidget);
    }
  }

  /**
   * Handle keyboard events, specifically ESC key to cancel streams
   */
  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._streamPromises.size > 0) {
      console.debug(
        `ESC pressed with ${this._streamPromises.size} active stream(s), cancelling`
      );
      this.cancelAllStreams();
    }
  }

  /**
   * Handle focus out events (clicking outside the notebook cell)
   */
  private _onFocusOut(_e: FocusEvent): void {
    // When focus leaves and we have active streams, cancel them
    // This is intentionally aggressive - better to cancel unnecessarily than to leave spinner
    if (this._streamPromises.size > 0) {
      // Small delay to let other more specific handlers fire first
      // (like activeCellChanged when tabbing between cells)
      setTimeout(() => {
        if (this._streamPromises.size > 0) {
          console.debug(
            `Focus lost with ${this._streamPromises.size} active stream(s), cancelling`
          );
          this.cancelAllStreams();
        }
      }, 100);
    }
  }

  /**
   * Set up listeners for notebook panel cell changes
   */
  private _setupNotebookListeners(notebook: NotebookPanel): void {
    if (this._currentNotebook === notebook) {
      return; // Already set up
    }

    // Disconnect from old notebook if exists
    if (this._currentNotebook) {
      this._currentNotebook.content.activeCellChanged.disconnect(
        this._onActiveCellChanged,
        this
      );
      // Also disconnect model content changed if it exists
      if (this._currentNotebook.content.model) {
        this._currentNotebook.content.model.contentChanged.disconnect(
          this._onContentChanged,
          this
        );
      }
    }

    // Connect to new notebook
    this._currentNotebook = notebook;
    notebook.content.activeCellChanged.connect(
      this._onActiveCellChanged,
      this
    );

    // Listen to notebook model content changes (detects completion acceptance)
    if (notebook.content.model) {
      notebook.content.model.contentChanged.connect(
        this._onContentChanged,
        this
      );
    }
  }

  /**
   * Handle notebook content changes (completion accepted, text edited)
   */
  private _onContentChanged(): void {
    // When content changes, cancel any active streams
    // This handles cases where completion was accepted or user typed something
    if (this._streamPromises.size > 0) {
      console.debug(
        `Notebook content changed with ${this._streamPromises.size} active stream(s), cancelling`
      );
      this.cancelAllStreams();
    }
  }

  /**
   * Handle active cell changes within a notebook
   */
  private _onActiveCellChanged(): void {
    if (this._streamPromises.size > 0) {
      console.debug(
        `Active cell changed with ${this._streamPromises.size} active stream(s), cancelling`
      );
      this.cancelAllStreams();
    }
  }

  /**
   * Handle shell changes (switching between notebooks, consoles, etc.)
   */
  private _onShellChanged(
    sender: any,
    args: { newValue: Widget | null; oldValue: Widget | null }
  ): void {
    // Cancel any active streams when switching widgets
    if (this._streamPromises.size > 0) {
      console.debug(
        `Shell changed with ${this._streamPromises.size} active stream(s), cancelling`
      );
      this.cancelAllStreams();
    }

    // Set up listeners for new notebook if applicable
    if (args.newValue instanceof NotebookPanel) {
      this._setupNotebookListeners(args.newValue);
    }
  }

  /**
   * Dispose of the provider and clean up event listeners
   */
  dispose(): void {
    // Remove keyboard listener
    document.removeEventListener('keydown', this._boundKeyDown);

    // Remove focus out listener
    document.removeEventListener('focusout', this._boundFocusOut);

    // Disconnect shell listener
    if (this.app.shell?.currentChanged) {
      this.app.shell.currentChanged.disconnect(this._onShellChanged, this);
    }

    // Disconnect notebook listeners
    if (this._currentNotebook) {
      this._currentNotebook.content.activeCellChanged.disconnect(
        this._onActiveCellChanged,
        this
      );
      // Disconnect content changed listener
      if (this._currentNotebook.content.model) {
        this._currentNotebook.content.model.contentChanged.disconnect(
          this._onContentChanged,
          this
        );
      }
      this._currentNotebook = null;
    }

    // Cancel all active streams
    this.cancelAllStreams();
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: IInlineCompletionContext
  ): Promise<IInlineCompletionList> {
    if (context.triggerKind === InlineCompletionTriggerKind.Automatic) {
      // Don't call the API when fetch is not manually triggered
      return { items: [] };
    }

    const streamingEnabled = this.settings.composite[
      'enableStreaming'
    ] as boolean;
    const text = getInputText(request.text, context.widget);

    if (streamingEnabled) {
      // Cancel any previous streams to prevent race conditions
      if (this._streamPromises.size > 0) {
        console.debug(
          `Cancelling ${this._streamPromises.size} existing stream(s) before starting new one`
        );
        this.cancelAllStreams();
      }

      // Create AbortController for this request
      const abortController = new AbortController();
      const streamToken = `qiskit-code-assistant_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Calculate adaptive timeout based on context size
      // Base timeout: 30s, plus up to 60s more for large contexts
      const baseTimeout = (this.schema.default as any).timeout || 30000;
      const contextBonus = Math.min(Math.floor(text.length / 50), 60000);
      const timeout = baseTimeout + contextBonus;

      const timeoutId = setTimeout(() => {
        console.warn(`Streaming request timed out after ${timeout}ms`);
        abortController.abort();
        this._streamPromises.delete(streamToken);
      }, timeout);

      const generator = autoCompleteStreaming(text, abortController.signal);

      // Store generator, controller, and timeout for tracking
      this._streamPromises.set(streamToken, {
        generator,
        abortController,
        timeoutId
      });

      return Promise.resolve({
        items: [
          {
            insertText: '',
            isIncomplete: true, // trigger the call to `stream()` for data
            token: streamToken
          }
        ]
      });
    } else {
      return autoComplete(text).then(results => {
        this.prompt_id = results.prompt_id;
        if (this.prompt_id) {
          lastPrompt = results;
          this.app.commands.notifyCommandChanged(FEEDBACK_COMMAND);
        }

        return {
          items: results.items.map((item: string): IInlineCompletionItem => {
            return { insertText: item };
          })
        };
      });
    }
  }

  /**
   * handle streaming prompt response
   * @param token
   */
  async *stream(token: string) {
    const streamContext = this._streamPromises.get(token);
    if (!streamContext) {
      console.warn(`Stream context not found for token: ${token}`);
      return;
    }

    const { generator, timeoutId } = streamContext;
    const textParts: string[] = [];
    let lastChunk: ICompletionReturn | undefined = undefined;

    try {
      for await (const chunk of generator) {
        lastChunk = chunk as ICompletionReturn;
        const newText = lastChunk.items[0];
        if (newText) {
          textParts.push(newText);
          yield { response: { insertText: textParts.join('') } };
        }

        // Update prompt_id immediately on first chunk to handle early cancellation
        // This ensures accept() has a valid prompt_id even if stream is cancelled
        if (lastChunk && lastChunk.prompt_id && !this.prompt_id) {
          this.prompt_id = lastChunk.prompt_id;
          lastPrompt = lastChunk;
          this.app.commands.notifyCommandChanged(FEEDBACK_COMMAND);
        }
      }

      // Update lastPrompt with final chunk data if we got more chunks
      if (lastChunk) {
        lastPrompt = lastChunk;
      }
    } catch (error) {
      // Handle errors during streaming
      if (error instanceof Error && error.name === 'AbortError') {
        console.debug(`Stream ${token} was aborted`);
      } else {
        console.error('Error during streaming:', error);
      }
    } finally {
      // Clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Always cleanup the stream context
      this._streamPromises.delete(token);
      // Remove loading spinner (handles external cancellation like cell change)
      StatusBarWidget.widget.stopLoadingStatus();
    }
  }

  /**
   * Cancel a specific stream by token
   * @param token The stream token to cancel
   */
  cancelStream(token: string): void {
    const streamContext = this._streamPromises.get(token);
    if (streamContext) {
      if (streamContext.timeoutId) {
        clearTimeout(streamContext.timeoutId);
      }
      streamContext.abortController.abort();
      this._streamPromises.delete(token);
      // Remove loading spinner when explicitly cancelling
      StatusBarWidget.widget.stopLoadingStatus();
      console.debug(`Cancelled stream: ${token}`);
    }
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    const count = this._streamPromises.size;

    for (const [token, context] of this._streamPromises.entries()) {
      if (context.timeoutId) {
        clearTimeout(context.timeoutId);
      }
      context.abortController.abort();
      console.debug(`Cancelled stream: ${token}`);
    }
    this._streamPromises.clear();

    // Remove loading spinner for each cancelled stream
    for (let i = 0; i < count; i++) {
      StatusBarWidget.widget.stopLoadingStatus();
    }
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
