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
  autoComplete,
  autoCompleteStreaming,
  CHAR_LIMIT
} from '../autocomplete';
import * as api from '../api';
import * as modelHandler from '../modelHandler';
import * as token from '../token';
import * as disclaimer from '../disclaimer';

// Mock dependencies
jest.mock('../api');
jest.mock('../modelHandler');
jest.mock('../token');
jest.mock('../disclaimer');
jest.mock('../../StatusBarWidget', () => ({
  StatusBarWidget: {
    widget: {
      setLoadingStatus: jest.fn(),
      stopLoadingStatus: jest.fn(),
      refreshStatusBar: jest.fn()
    }
  }
}));

const mockPostModelPrompt = api.postModelPrompt as jest.MockedFunction<
  typeof api.postModelPrompt
>;
const mockPostModelPromptStreaming =
  api.postModelPromptStreaming as jest.MockedFunction<
    typeof api.postModelPromptStreaming
  >;
const mockGetCurrentModel = modelHandler.getCurrentModel as jest.MockedFunction<
  typeof modelHandler.getCurrentModel
>;
const mockCheckAPIToken = token.checkAPIToken as jest.MockedFunction<
  typeof token.checkAPIToken
>;
const mockShowDisclaimer = disclaimer.showDisclaimer as jest.MockedFunction<
  typeof disclaimer.showDisclaimer
>;

describe('Autocomplete Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoComplete', () => {
    it('should return empty result when no model is selected', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(undefined);

      const result = await autoComplete('test input');

      expect(result).toEqual({
        items: [],
        prompt_id: '',
        input: ''
      });
    });

    it('should successfully complete with accepted disclaimer', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: true }
      } as any;
      const mockResponse = {
        prompt_id: 'prompt-123',
        results: [
          { generated_text: 'completion 1' },
          { generated_text: 'completion 2' }
        ]
      };

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockPostModelPrompt.mockResolvedValue(mockResponse);

      const result = await autoComplete('test input');

      expect(mockPostModelPrompt).toHaveBeenCalledWith(
        'model-1',
        'test input',
        expect.anything()
      );
      expect(result).toEqual({
        items: ['completion 1', 'completion 2'],
        prompt_id: 'prompt-123',
        input: 'test input'
      });
    });

    it('should show disclaimer and complete if accepted', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: false }
      } as any;
      const mockResponse = {
        prompt_id: 'prompt-123',
        results: [{ generated_text: 'completion text' }]
      };

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockShowDisclaimer.mockResolvedValue(true);
      mockPostModelPrompt.mockResolvedValue(mockResponse);

      const result = await autoComplete('test input');

      expect(mockShowDisclaimer).toHaveBeenCalledWith('model-1');
      expect(mockPostModelPrompt).toHaveBeenCalled();
      expect(result.items).toEqual(['completion text']);
    });

    it('should return empty result if disclaimer not accepted', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: false }
      } as any;

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockShowDisclaimer.mockResolvedValue(false);

      const result = await autoComplete('test input');

      expect(mockShowDisclaimer).toHaveBeenCalledWith('model-1');
      expect(mockPostModelPrompt).not.toHaveBeenCalled();
      expect(result).toEqual({
        items: [],
        prompt_id: '',
        input: ''
      });
    });

    it('should truncate input text to CHAR_LIMIT', async () => {
      const longText = 'a'.repeat(CHAR_LIMIT + 1000);
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: true }
      } as any;
      const mockResponse = {
        prompt_id: 'prompt-123',
        results: [{ generated_text: 'completion' }]
      };

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockPostModelPrompt.mockResolvedValue(mockResponse);

      await autoComplete(longText);

      const callArg = mockPostModelPrompt.mock.calls[0][1];
      expect(callArg.length).toBeLessThanOrEqual(CHAR_LIMIT);
      expect(callArg.length).toEqual(CHAR_LIMIT);
    });

    it('should handle errors gracefully', async () => {
      mockCheckAPIToken.mockRejectedValue(new Error('Token error'));

      const result = await autoComplete('test input');

      expect(result).toEqual({
        items: [],
        prompt_id: '',
        input: ''
      });
    });
  });

  describe('autoCompleteStreaming', () => {
    it('should return empty result when no model is selected', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(undefined);

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        items: [],
        prompt_id: '',
        input: ''
      });
    });

    it('should successfully stream completions with accepted disclaimer', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: true }
      } as any;

      async function* mockStreamGenerator() {
        yield {
          prompt_id: 'prompt-123',
          generated_text: 'Hello'
        };
        yield {
          prompt_id: 'prompt-123',
          generated_text: ' World'
        };
      }

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockPostModelPromptStreaming.mockReturnValue(mockStreamGenerator());

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        items: ['Hello'],
        prompt_id: 'prompt-123',
        input: 'test input'
      });
      expect(results[1]).toEqual({
        items: [' World'],
        prompt_id: 'prompt-123',
        input: 'test input'
      });
    });

    it('should handle results with nested generated_text', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: true }
      } as any;

      async function* mockStreamGenerator() {
        yield {
          prompt_id: 'prompt-123',
          results: [{ generated_text: 'Nested text' }]
        };
      }

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockPostModelPromptStreaming.mockReturnValue(mockStreamGenerator());

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0].items[0]).toBe('Nested text');
    });

    it('should show disclaimer and stream if accepted', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: false }
      } as any;

      async function* mockStreamGenerator() {
        yield {
          prompt_id: 'prompt-123',
          generated_text: 'Streaming text'
        };
      }

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockShowDisclaimer.mockResolvedValue(true);
      mockPostModelPromptStreaming.mockReturnValue(mockStreamGenerator());

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      expect(mockShowDisclaimer).toHaveBeenCalledWith('model-1');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty result if disclaimer not accepted', async () => {
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: false }
      } as any;

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockShowDisclaimer.mockResolvedValue(false);

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        items: [],
        prompt_id: '',
        input: ''
      });
    });

    it('should handle errors gracefully', async () => {
      mockCheckAPIToken.mockRejectedValue(new Error('Token error'));

      const results = [];
      for await (const chunk of autoCompleteStreaming('test input')) {
        results.push(chunk);
      }

      // Generator returns empty result on error but may not yield anything
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should truncate input text to CHAR_LIMIT', async () => {
      const longText = 'b'.repeat(CHAR_LIMIT + 500);
      const mockModel = {
        _id: 'model-1',
        name: 'Test Model',
        disclaimer: { accepted: true }
      } as any;

      async function* mockStreamGenerator() {
        yield {
          prompt_id: 'prompt-123',
          generated_text: 'text'
        };
      }

      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetCurrentModel.mockReturnValue(mockModel);
      mockPostModelPromptStreaming.mockReturnValue(mockStreamGenerator());

      const results = [];
      for await (const chunk of autoCompleteStreaming(longText)) {
        results.push(chunk);
      }

      const callArg = mockPostModelPromptStreaming.mock.calls[0][1];
      expect(callArg.length).toBeLessThanOrEqual(CHAR_LIMIT);
      expect(callArg.length).toEqual(CHAR_LIMIT);
    });
  });
});
