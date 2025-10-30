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

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the requestd
 * @returns The response body interpreted as JSON
 */
export async function requestAPI(
  endPoint: string = '',
  init: RequestInit = {}
): Promise<Response> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'qiskit-code-assistant', // API Namespace
    endPoint
  );

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    console.error(
      'The qiskit_code_assistant_jupyterlab server extension appears to be missing.\n',
      error
    );
    throw new ServerConnection.NetworkError(error as any);
  }

  return response;
}

/**
 * Call the API extension using streaming
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @param signal Optional AbortSignal for cancellation
 * @returns The response body interpreted as JSON
 */
export async function* requestAPIStreaming(
  endPoint: string = '',
  init: RequestInit = {},
  signal?: AbortSignal
): AsyncGenerator<string> {
  // Handle streaming request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'qiskit-code-assistant', // API Namespace
    endPoint
  );

  // Merge provided signal with init
  const requestInit: RequestInit = {
    ...init,
    signal: signal || init.signal
  };

  let response: Response;
  const decoder = new TextDecoder(); // Reuse decoder for performance

  try {
    response = await ServerConnection.makeRequest(
      requestUrl,
      requestInit,
      settings
    );

    if (!response.body) {
      console.error(
        'The qiskit_code_assistant_jupyterlab server extension request returned no body.'
      );
      throw new ServerConnection.ResponseError(
        response,
        'Fetch failed. No response body returned.'
      );
    }

    // Stream the response
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        // Decode chunk using stream mode for proper handling of multi-byte characters
        yield decoder.decode(value, { stream: true });
      }
      // Final decode call without stream flag to flush any remaining bytes
      const finalChunk = decoder.decode();
      if (finalChunk) {
        yield finalChunk;
      }
    } finally {
      // Ensure reader is released even if error occurs
      reader.releaseLock();
    }
  } catch (error) {
    // Check if error is due to abort
    if (error instanceof Error && error.name === 'AbortError') {
      console.debug('Streaming request was aborted');
      throw error;
    }
    console.error(
      'The qiskit_code_assistant_jupyterlab server extension appears to be missing.\n',
      error
    );
    throw new ServerConnection.NetworkError(error as any);
  }
}
