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

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  QiskitCompletionProvider,
  QiskitInlineCompletionProvider,
  wipeLastPrompt,
  lastPrompt
} from '../QiskitCompletionProvider';
import { InlineCompletionTriggerKind } from '@jupyterlab/completer';
import { NotebookPanel } from '@jupyterlab/notebook';
import * as autocomplete from '../service/autocomplete';
import * as api from '../service/api';

// Mock dependencies
jest.mock('../service/autocomplete');
jest.mock('../service/api');
jest.mock('../StatusBarWidget', () => ({
  StatusBarWidget: {
    widget: {
      setLoadingStatus: jest.fn(),
      stopLoadingStatus: jest.fn(),
      refreshStatusBar: jest.fn()
    }
  }
}));

const mockAutoComplete = autocomplete.autoComplete as jest.MockedFunction<
  typeof autocomplete.autoComplete
>;
const mockAutoCompleteStreaming =
  autocomplete.autoCompleteStreaming as jest.MockedFunction<
    typeof autocomplete.autoCompleteStreaming
  >;
const mockPostModelPromptAccept =
  api.postModelPromptAccept as jest.MockedFunction<
    typeof api.postModelPromptAccept
  >;

describe('QiskitCompletionProvider', () => {
  let provider: QiskitCompletionProvider;
  let mockSettings: any;
  let mockApp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    wipeLastPrompt();

    mockSettings = {
      composite: {
        enableCompleter: true
      }
    };

    mockApp = {
      commands: {
        notifyCommandChanged: jest.fn()
      },
      shell: {
        currentWidget: null
      }
    };

    provider = new QiskitCompletionProvider({
      settings: mockSettings,
      app: mockApp
    });
  });

  describe('constructor', () => {
    it('should initialize with correct identifier and rank', () => {
      expect(provider.identifier).toBe('QiskitCodeAssistant:completer');
      expect(provider.rank).toBe(1100);
    });
  });

  describe('fetch', () => {
    it('should fetch completions successfully', async () => {
      const mockResults = {
        items: ['completion1', 'completion2'],
        prompt_id: 'prompt-123',
        input: 'test'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const request = {
        text: 'test input',
        offset: 10
      } as any;

      const context = {
        widget: {} as any
      } as any;

      const result = await provider.fetch(request, context);

      expect(mockAutoComplete).toHaveBeenCalledWith('test input');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].label).toBe('completion1');
      expect(result.items[0].insertText).toBe('completion1');
      expect(result.start).toBe(10);
      expect(result.end).toBe(10);
    });

    it('should update lastPrompt when prompt_id is present', async () => {
      const mockResults = {
        items: ['completion'],
        prompt_id: 'prompt-123',
        input: 'test'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const request = { text: 'test', offset: 0 } as any;
      const context = { widget: {} as any } as any;

      await provider.fetch(request, context);

      expect(mockApp.commands.notifyCommandChanged).toHaveBeenCalled();
    });

    it('should handle notebook context and aggregate cell contents', async () => {
      const mockResults = {
        items: ['completion'],
        prompt_id: 'prompt-123',
        input: 'aggregated text'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const mockCells = [
        {
          model: {
            type: 'code',
            toJSON: () => ({ source: 'cell 1 content' })
          }
        },
        {
          model: {
            type: 'code',
            toJSON: () => ({ source: ['cell 2', ' content'] })
          }
        }
      ];

      // Create a proper NotebookPanel instance using Object.create
      const mockNotebookPanel = Object.create(NotebookPanel.prototype);
      mockNotebookPanel.content = {
        activeCellIndex: 2,
        widgets: mockCells
      };

      const context = {
        widget: mockNotebookPanel
      } as any;

      const request = { text: 'current cell', offset: 0 } as any;

      await provider.fetch(request, context);

      // Verify that cells were aggregated correctly
      // When cell source is an array, it's joined with newlines
      expect(mockAutoComplete).toHaveBeenCalledWith(
        'cell 1 content\ncell 2\n content\ncurrent cell'
      );
    });

    it('should skip non-code/markdown cells when aggregating', async () => {
      const mockResults = {
        items: ['completion'],
        prompt_id: 'prompt-123',
        input: 'aggregated text'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const mockCells = [
        {
          model: {
            type: 'code',
            toJSON: () => ({ source: 'code cell' })
          }
        },
        {
          model: {
            type: 'raw',
            toJSON: () => ({ source: 'should be skipped' })
          }
        },
        {
          model: {
            type: 'markdown',
            toJSON: () => ({ source: 'markdown cell' })
          }
        }
      ];

      const mockNotebookPanel = Object.create(NotebookPanel.prototype);
      mockNotebookPanel.content = {
        activeCellIndex: 3,
        widgets: mockCells
      };

      const context = {
        widget: mockNotebookPanel
      } as any;

      const request = { text: 'current', offset: 0 } as any;

      await provider.fetch(request, context);

      // Should only include code and markdown cells, not raw
      expect(mockAutoComplete).toHaveBeenCalledWith(
        'code cell\nmarkdown cell\ncurrent'
      );
    });

    it('should handle non-notebook widgets', async () => {
      const mockResults = {
        items: ['completion'],
        prompt_id: 'prompt-123',
        input: 'text'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const context = {
        widget: {} // Not a NotebookPanel
      } as any;

      const request = { text: 'some text', offset: 0 } as any;

      await provider.fetch(request, context);

      // Should just use the text as-is without aggregation
      expect(mockAutoComplete).toHaveBeenCalledWith('some text');
    });
  });

  describe('isApplicable', () => {
    it('should return true when enableCompleter is true', async () => {
      mockSettings.composite.enableCompleter = true;
      const result = await provider.isApplicable({} as any);
      expect(result).toBe(true);
    });

    it('should return false when enableCompleter is false', async () => {
      mockSettings.composite.enableCompleter = false;
      const result = await provider.isApplicable({} as any);
      expect(result).toBe(false);
    });
  });

  describe('accept', () => {
    it('should post acceptance when prompt_id exists and text matches', async () => {
      mockPostModelPromptAccept.mockResolvedValue({
        message: 'Accepted'
      } as any);

      provider.prompt_id = 'prompt-123';
      provider.results = ['completion1', 'completion2'];

      await provider.accept('completion1');

      expect(mockPostModelPromptAccept).toHaveBeenCalledWith('prompt-123');
    });

    it('should not post acceptance when text does not match results', async () => {
      provider.prompt_id = 'prompt-123';
      provider.results = ['completion1', 'completion2'];

      await provider.accept('different text');

      expect(mockPostModelPromptAccept).not.toHaveBeenCalled();
    });

    it('should not post acceptance when prompt_id is empty', async () => {
      provider.prompt_id = '';
      provider.results = ['completion1'];

      await provider.accept('completion1');

      expect(mockPostModelPromptAccept).not.toHaveBeenCalled();
    });
  });
});

describe('QiskitInlineCompletionProvider', () => {
  let provider: QiskitInlineCompletionProvider;
  let mockSettings: any;
  let mockApp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    wipeLastPrompt();

    mockSettings = {
      composite: {
        enableStreaming: false
      }
    };

    mockApp = {
      commands: {
        notifyCommandChanged: jest.fn()
      },
      shell: {
        currentWidget: null
      }
    };

    provider = new QiskitInlineCompletionProvider({
      settings: mockSettings,
      app: mockApp
    });
  });

  describe('constructor', () => {
    it('should initialize with correct identifier and name', () => {
      expect(provider.identifier).toBe(
        'qiskit-code-assistant-inline-completer'
      );
      expect(provider.name).toBe('Qiskit Code Assistant');
    });
  });

  describe('fetch', () => {
    it('should return empty items for automatic trigger', async () => {
      const request = { text: 'test', offset: 0 } as any;
      const context = {
        triggerKind: InlineCompletionTriggerKind.Automatic,
        widget: {} as any
      } as any;

      const result = await provider.fetch(request, context);

      expect(result.items).toHaveLength(0);
      expect(mockAutoComplete).not.toHaveBeenCalled();
    });

    it('should fetch completions for manual trigger without streaming', async () => {
      const mockResults = {
        items: ['completion1', 'completion2'],
        prompt_id: 'prompt-123',
        input: 'test'
      };
      mockAutoComplete.mockResolvedValue(mockResults);

      const request = { text: 'test', offset: 0 } as any;
      const context = {
        triggerKind: InlineCompletionTriggerKind.Invoke,
        widget: {} as any
      } as any;

      const result = await provider.fetch(request, context);

      expect(mockAutoComplete).toHaveBeenCalledWith('test');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].insertText).toBe('completion1');
    });

    it('should set up streaming for manual trigger with streaming enabled', async () => {
      mockSettings.composite.enableStreaming = true;

      async function* mockGenerator() {
        yield { items: ['chunk'], prompt_id: 'prompt-123', input: 'test' };
      }

      mockAutoCompleteStreaming.mockReturnValue(mockGenerator());

      const request = { text: 'test', offset: 0 } as any;
      const context = {
        triggerKind: InlineCompletionTriggerKind.Invoke,
        widget: {} as any
      } as any;

      const result = await provider.fetch(request, context);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].isIncomplete).toBe(true);
      expect(result.items[0].token).toBeDefined();
      expect(provider._streamPromises.size).toBe(1);
    });

    it('should cancel existing streams before starting new one', async () => {
      mockSettings.composite.enableStreaming = true;
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

      // Set up an existing stream
      const existingController = new AbortController();
      const abortSpy = jest.spyOn(existingController, 'abort');
      // eslint-disable-next-line require-yield
      provider._streamPromises.set('existing-token', {
        generator: (async function* () {})(),
        abortController: existingController,
        timeoutId: undefined
      });

      async function* mockGenerator() {
        yield { items: ['new chunk'], prompt_id: 'p1', input: 'test' };
      }

      mockAutoCompleteStreaming.mockReturnValue(mockGenerator());

      const request = { text: 'test', offset: 0 } as any;
      const context = {
        triggerKind: InlineCompletionTriggerKind.Invoke,
        widget: {} as any
      } as any;

      await provider.fetch(request, context);

      // Should have logged cancellation and aborted existing stream
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cancelling')
      );
      expect(abortSpy).toHaveBeenCalled();
      expect(provider._streamPromises.has('existing-token')).toBe(false);

      consoleDebugSpy.mockRestore();
    });
  });

  describe('stream', () => {
    it('should stream completion chunks', async () => {
      const mockChunks = [
        { items: ['Hello'], prompt_id: 'prompt-123', input: 'test' },
        { items: [' World'], prompt_id: 'prompt-123', input: 'test' }
      ];

      async function* mockGenerator() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      const token = 'test-token';
      const mockAbortController = new AbortController();
      provider._streamPromises.set(token, {
        generator: mockGenerator(),
        abortController: mockAbortController,
        timeoutId: undefined
      });

      const results = [];
      for await (const chunk of provider.stream(token)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0].response.insertText).toBe('Hello');
      expect(results[1].response.insertText).toBe('Hello World');
      expect(provider._streamPromises.has(token)).toBe(false);
    });

    it('should not yield anything for invalid token', async () => {
      const results = [];
      for await (const chunk of provider.stream('invalid-token')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });

    it('should update lastPrompt after streaming completes', async () => {
      const mockChunks = [
        { items: ['text'], prompt_id: 'prompt-123', input: 'test' }
      ];

      async function* mockGenerator() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      const token = 'test-token';
      const mockAbortController = new AbortController();
      provider._streamPromises.set(token, {
        generator: mockGenerator(),
        abortController: mockAbortController,
        timeoutId: undefined
      });

      const results = [];
      for await (const chunk of provider.stream(token)) {
        results.push(chunk);
      }

      expect(mockApp.commands.notifyCommandChanged).toHaveBeenCalled();
    });

    it('should handle AbortError gracefully', async () => {
      // eslint-disable-next-line require-yield
      async function* mockGenerator() {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        throw error;
      }

      const token = 'test-token';
      const mockAbortController = new AbortController();
      provider._streamPromises.set(token, {
        generator: mockGenerator(),
        abortController: mockAbortController,
        timeoutId: undefined
      });

      const results = [];
      for await (const chunk of provider.stream(token)) {
        results.push(chunk);
      }

      // Should handle error gracefully, no results
      expect(results).toHaveLength(0);
      expect(provider._streamPromises.has(token)).toBe(false);
    });

    it('should handle other errors during streaming', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // eslint-disable-next-line require-yield
      async function* mockGenerator() {
        throw new Error('Network error');
      }

      const token = 'test-token';
      const mockAbortController = new AbortController();
      provider._streamPromises.set(token, {
        generator: mockGenerator(),
        abortController: mockAbortController,
        timeoutId: undefined
      });

      const results = [];
      for await (const chunk of provider.stream(token)) {
        results.push(chunk);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during streaming:',
        expect.any(Error)
      );
      expect(provider._streamPromises.has(token)).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should clear timeout when stream completes', async () => {
      const mockChunks = [{ items: ['text'], prompt_id: 'p1', input: 'test' }];

      async function* mockGenerator() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      const token = 'test-token';
      const mockAbortController = new AbortController();
      const mockTimeoutId = setTimeout(() => {}, 5000) as any;
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      provider._streamPromises.set(token, {
        generator: mockGenerator(),
        abortController: mockAbortController,
        timeoutId: mockTimeoutId
      });

      const results = [];
      for await (const chunk of provider.stream(token)) {
        results.push(chunk);
      }

      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeoutId);
      clearTimeoutSpy.mockRestore();
      clearTimeout(mockTimeoutId);
    });
  });

  describe('cancelStream', () => {
    it('should cancel a specific stream by token', () => {
      const token = 'test-token';
      const mockAbortController = new AbortController();
      const abortSpy = jest.spyOn(mockAbortController, 'abort');
      const mockTimeoutId = setTimeout(() => {}, 5000) as any;

      provider._streamPromises.set(token, {
        generator: (async function* () {})(),
        abortController: mockAbortController,
        timeoutId: mockTimeoutId
      });

      provider.cancelStream(token);

      expect(abortSpy).toHaveBeenCalled();
      expect(provider._streamPromises.has(token)).toBe(false);

      clearTimeout(mockTimeoutId);
    });

    it('should do nothing when cancelling non-existent stream', () => {
      provider.cancelStream('non-existent-token');
      // Should not throw
      expect(provider._streamPromises.size).toBe(0);
    });
  });

  describe('cancelAllStreams', () => {
    it('should cancel all active streams', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const abortSpy1 = jest.spyOn(controller1, 'abort');
      const abortSpy2 = jest.spyOn(controller2, 'abort');
      const timeout1 = setTimeout(() => {}, 5000) as any;
      const timeout2 = setTimeout(() => {}, 5000) as any;

      provider._streamPromises.set('token1', {
        generator: (async function* () {})(),
        abortController: controller1,
        timeoutId: timeout1
      });

      provider._streamPromises.set('token2', {
        generator: (async function* () {})(),
        abortController: controller2,
        timeoutId: timeout2
      });

      provider.cancelAllStreams();

      expect(abortSpy1).toHaveBeenCalled();
      expect(abortSpy2).toHaveBeenCalled();
      expect(provider._streamPromises.size).toBe(0);

      clearTimeout(timeout1);
      clearTimeout(timeout2);
    });
  });

  describe('isApplicable', () => {
    it('should always return true', async () => {
      const result = await provider.isApplicable({} as any);
      expect(result).toBe(true);
    });
  });

  describe('accept', () => {
    it('should post acceptance when prompt_id exists', async () => {
      mockPostModelPromptAccept.mockResolvedValue({
        message: 'Accepted'
      } as any);

      provider.prompt_id = 'prompt-123';
      await provider.accept();

      expect(mockPostModelPromptAccept).toHaveBeenCalledWith('prompt-123');
    });

    it('should not post acceptance when prompt_id is empty', async () => {
      provider.prompt_id = '';
      await provider.accept();

      expect(mockPostModelPromptAccept).not.toHaveBeenCalled();
    });
  });
});

describe('wipeLastPrompt', () => {
  it('should clear lastPrompt', () => {
    // This test verifies the exported function works
    wipeLastPrompt();
    expect(lastPrompt).toBeUndefined();
  });
});
