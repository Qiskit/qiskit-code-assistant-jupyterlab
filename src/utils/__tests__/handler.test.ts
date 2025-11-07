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

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { requestAPI, requestAPIStreaming } from '../handler';
import { ServerConnection } from '@jupyterlab/services';
import { URLExt } from '@jupyterlab/coreutils';

// Mock JupyterLab dependencies
jest.mock('@jupyterlab/services');
jest.mock('@jupyterlab/coreutils');

const mockMakeSettings = ServerConnection.makeSettings as jest.MockedFunction<
  typeof ServerConnection.makeSettings
>;
const mockMakeRequest = ServerConnection.makeRequest as jest.MockedFunction<
  typeof ServerConnection.makeRequest
>;
const mockURLExtJoin = URLExt.join as jest.MockedFunction<typeof URLExt.join>;

describe('Handler Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeSettings.mockReturnValue({
      baseUrl: 'http://localhost:8888/'
    } as any);
    mockURLExtJoin.mockReturnValue(
      'http://localhost:8888/qiskit-code-assistant/test'
    );
  });

  describe('requestAPI', () => {
    it('should make a successful API request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' })
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await requestAPI('test');

      expect(mockMakeSettings).toHaveBeenCalled();
      expect(mockURLExtJoin).toHaveBeenCalledWith(
        'http://localhost:8888/',
        'qiskit-code-assistant',
        'test'
      );
      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result).toBe(mockResponse);
    });

    it('should make a POST request with body', async () => {
      const mockResponse = { ok: true } as any;
      mockMakeRequest.mockResolvedValue(mockResponse);

      const init = {
        method: 'POST',
        body: JSON.stringify({ key: 'value' })
      };

      await requestAPI('endpoint', init);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        'http://localhost:8888/qiskit-code-assistant/test',
        init,
        expect.anything()
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network failure');
      mockMakeRequest.mockRejectedValue(networkError);

      await expect(requestAPI('test')).rejects.toThrow();
    });

    it('should use default endpoint when none provided', async () => {
      const mockResponse = { ok: true } as any;
      mockMakeRequest.mockResolvedValue(mockResponse);

      await requestAPI();

      expect(mockURLExtJoin).toHaveBeenCalledWith(
        'http://localhost:8888/',
        'qiskit-code-assistant',
        ''
      );
    });
  });

  describe('requestAPIStreaming', () => {
    it('should stream response chunks', async () => {
      const mockChunks = [
        new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
        new Uint8Array([32, 87, 111, 114, 108, 100]) // " World"
      ];

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockChunks[0] })
          .mockResolvedValueOnce({ done: false, value: mockChunks[1] })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const results = [];
      for await (const chunk of requestAPIStreaming('stream-test')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('Hello');
      expect(results[1]).toBe(' World');
    });

    it('should handle empty response body', async () => {
      const mockResponse = {
        ok: true,
        body: null
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const generator = requestAPIStreaming('test');
      await expect(generator.next()).rejects.toThrow();
    });

    it('should handle streaming network errors', async () => {
      const networkError = new Error('Streaming failure');
      mockMakeRequest.mockRejectedValue(networkError);

      const generator = requestAPIStreaming('test');
      await expect(generator.next()).rejects.toThrow();
    });

    it('should decode UTF-8 chunks correctly', async () => {
      // Test with multi-byte UTF-8 characters
      const utf8String = 'Hello 世界';
      const encoder = new TextEncoder();
      const encoded = encoder.encode(utf8String);

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: encoded })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const results = [];
      for await (const chunk of requestAPIStreaming('test')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(utf8String);
    });

    it('should use default endpoint when none provided', async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const results = [];
      for await (const chunk of requestAPIStreaming()) {
        results.push(chunk);
      }

      expect(mockURLExtJoin).toHaveBeenCalledWith(
        'http://localhost:8888/',
        'qiskit-code-assistant',
        ''
      );
    });

    it('should yield final decoded chunk if present', async () => {
      // Test the finalChunk path (line 114)
      // Simulate a scenario where decoder.decode() returns a final chunk
      const encoder = new TextEncoder();
      const chunk = encoder.encode('test');

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const results = [];
      for await (const chunk of requestAPIStreaming('test')) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle AbortError during streaming', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      const mockReader = {
        read: jest.fn().mockRejectedValue(abortError),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      const generator = requestAPIStreaming('test');
      await expect(generator.next()).rejects.toThrow('Aborted');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'Streaming request was aborted'
      );

      consoleDebugSpy.mockRestore();
    });

    it('should release lock even when error occurs', async () => {
      const testError = new Error('Network error');

      const mockReader = {
        read: jest.fn().mockRejectedValue(testError),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      } as any;

      mockMakeRequest.mockResolvedValue(mockResponse);

      const generator = requestAPIStreaming('test');
      await expect(generator.next()).rejects.toThrow('Network error');

      // Verify releaseLock was called even though error occurred
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });
  });
});
