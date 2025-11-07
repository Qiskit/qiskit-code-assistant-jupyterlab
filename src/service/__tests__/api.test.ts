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
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import * as api from '../api';
import * as handler from '../../utils/handler';

// Mock the handler module
jest.mock('../../utils/handler');
jest.mock('@jupyterlab/apputils', () => ({
  Notification: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

const mockRequestAPI = handler.requestAPI as jest.MockedFunction<
  typeof handler.requestAPI
>;
const mockRequestAPIStreaming =
  handler.requestAPIStreaming as jest.MockedFunction<
    typeof handler.requestAPIStreaming
  >;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('postServiceUrl', () => {
    it('should successfully post a new service URL', async () => {
      const mockUrl = 'https://api.example.com';
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ url: mockUrl, is_openai: false })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.postServiceUrl(mockUrl);

      expect(mockRequestAPI).toHaveBeenCalledWith('service', {
        method: 'POST',
        body: JSON.stringify({ url: mockUrl })
      });
      expect(result).toEqual({ url: mockUrl, is_openai: false });
    });

    it('should handle errors when posting service URL', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(api.postServiceUrl('invalid-url')).rejects.toThrow(
        'Internal Server Error'
      );
    });
  });

  describe('getAPIToken', () => {
    it('should successfully get API token status', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.getAPIToken();

      expect(mockRequestAPI).toHaveBeenCalledWith('token');
      expect(result).toBe(true);
    });

    it('should handle errors when getting API token', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(api.getAPIToken()).rejects.toThrow('Not Found');
    });
  });

  describe('postApiToken', () => {
    it('should successfully post API token', async () => {
      const mockToken = 'test-token-123';
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await api.postApiToken(mockToken);

      expect(mockRequestAPI).toHaveBeenCalledWith('token', {
        method: 'POST',
        body: JSON.stringify({ token: mockToken })
      });
    });

    it('should handle errors when posting API token', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(api.postApiToken('invalid-token')).rejects.toThrow(
        'Bad Request'
      );
    });
  });

  describe('getModels', () => {
    it('should successfully get models list', async () => {
      const mockModels = [
        { _id: 'model-1', name: 'Model 1' },
        { _id: 'model-2', name: 'Model 2' }
      ];
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ models: mockModels })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.getModels();

      expect(mockRequestAPI).toHaveBeenCalledWith('models');
      expect(result).toEqual(mockModels);
    });

    it('should handle errors when getting models', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: jest.fn().mockResolvedValue({})
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(api.getModels()).rejects.toThrow('Forbidden');
    });
  });

  describe('getModel', () => {
    it('should successfully get a specific model', async () => {
      const mockModel = { _id: 'model-1', name: 'Model 1' };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockModel)
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.getModel('model-1');

      expect(mockRequestAPI).toHaveBeenCalledWith('model/model-1');
      expect(result).toEqual(mockModel);
    });
  });

  describe('getModelDisclaimer', () => {
    it('should successfully get model disclaimer', async () => {
      const mockDisclaimer = {
        disclaimer_id: 'disclaimer-1',
        content: 'Test disclaimer'
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockDisclaimer)
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.getModelDisclaimer('model-1');

      expect(mockRequestAPI).toHaveBeenCalledWith('model/model-1/disclaimer');
      expect(result).toEqual(mockDisclaimer);
    });
  });

  describe('postDisclaimerAccept', () => {
    it('should successfully post disclaimer acceptance', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Accepted' })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.postDisclaimerAccept('disclaimer-1', 'model-1');

      expect(mockRequestAPI).toHaveBeenCalledWith(
        'disclaimer/disclaimer-1/acceptance',
        {
          method: 'POST',
          body: JSON.stringify({ model: 'model-1', accepted: true })
        }
      );
      expect(result).toEqual({ message: 'Accepted' });
    });
  });

  describe('postModelPrompt', () => {
    it('should successfully post a model prompt', async () => {
      const mockPromptResponse = {
        prompt_id: 'prompt-123',
        results: [{ generated_text: 'Generated code here' }]
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockPromptResponse)
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.postModelPrompt('model-1', 'test input');

      expect(mockRequestAPI).toHaveBeenCalledWith('model/model-1/prompt', {
        method: 'POST',
        body: JSON.stringify({ input: 'test input' })
      });
      expect(result).toEqual(mockPromptResponse);
    });

    it('should handle errors when posting model prompt', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({})
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(api.postModelPrompt('model-1', 'test')).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  describe('postModelPromptStreaming', () => {
    it('should successfully stream model prompt responses', async () => {
      const mockChunks = [
        'data: {"prompt_id":"prompt-123","generated_text":"Hello"}\n',
        'data: {"prompt_id":"prompt-123","generated_text":" World"}\n'
      ];

      async function* mockGenerator() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockRequestAPIStreaming.mockReturnValue(mockGenerator());

      const results = [];
      for await (const chunk of api.postModelPromptStreaming(
        'model-1',
        'test input'
      )) {
        results.push(chunk);
      }

      expect(mockRequestAPIStreaming).toHaveBeenCalledWith(
        'model/model-1/prompt',
        {
          method: 'POST',
          body: JSON.stringify({ input: 'test input', stream: true })
        },
        undefined
      );
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        prompt_id: 'prompt-123',
        generated_text: 'Hello'
      });
    });

    it('should handle malformed JSON in streaming response', async () => {
      const mockChunks = [
        'data: invalid json\n',
        'data: {"prompt_id":"prompt-123","generated_text":"Valid"}\n'
      ];

      async function* mockGenerator() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockRequestAPIStreaming.mockReturnValue(mockGenerator());

      const results = [];
      for await (const chunk of api.postModelPromptStreaming(
        'model-1',
        'test'
      )) {
        results.push(chunk);
      }

      // Should only have the valid chunk
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        prompt_id: 'prompt-123',
        generated_text: 'Valid'
      });
    });
  });

  describe('postModelPromptAccept', () => {
    it('should successfully post prompt acceptance', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Accepted' })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.postModelPromptAccept('prompt-123');

      expect(mockRequestAPI).toHaveBeenCalledWith(
        'prompt/prompt-123/acceptance',
        {
          method: 'POST',
          body: JSON.stringify({ accepted: true })
        }
      );
      expect(result).toEqual({ message: 'Accepted' });
    });
  });

  describe('postFeedback', () => {
    it('should successfully post feedback', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ feedback_id: 'feedback-123' })
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      const result = await api.postFeedback(
        'model-1',
        'prompt-123',
        true,
        'Great!',
        'input text',
        'output text'
      );

      expect(mockRequestAPI).toHaveBeenCalledWith('feedback', {
        method: 'POST',
        body: JSON.stringify({
          model_id: 'model-1',
          prompt_id: 'prompt-123',
          positive_feedback: true,
          comment: 'Great!',
          input: 'input text',
          output: 'output text'
        })
      });
      expect(result).toEqual({ feedback_id: 'feedback-123' });
    });

    it('should handle errors when posting feedback', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: jest.fn().mockResolvedValue({})
      } as any;

      mockRequestAPI.mockResolvedValue(mockResponse);

      await expect(
        api.postFeedback('model-1', 'prompt-123', true)
      ).rejects.toThrow('Server Error');
    });
  });
});
