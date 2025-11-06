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

import { Notification } from '@jupyterlab/apputils';

import { requestAPI, requestAPIStreaming } from '../utils/handler';
import {
  IFeedbackResponse,
  IModelDisclaimer,
  IModelInfo,
  IModelPromptResponse,
  IResponseMessage,
  IServiceResponse
} from '../utils/schema';

const AUTH_ERROR_CODES = [401, 403, 422];
const STREAM_DATA_PREFIX = 'data: ';
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer size to prevent memory issues

async function notifyInvalid(response: Response): Promise<void> {
  if (AUTH_ERROR_CODES.includes(response.status)) {
    await response.json().then(json => {
      if (json.detail) {
        Notification.error(`Qiskit Code Assistant:\n${json.detail}`, {
          autoClose: false
        });
      }
    });
  }
}

// POST /service
export async function postServiceUrl(
  newUrl: string
): Promise<IServiceResponse> {
  return await requestAPI('service', {
    method: 'POST',
    body: JSON.stringify({ url: newUrl })
  }).then(response => {
    if (response.ok) {
      return response.json().then(json => {
        console.debug('Updated service URL:', json.url);
        return json;
      });
    } else {
      console.error(
        'Error updating service URL',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// GET /token
export async function getAPIToken(): Promise<boolean> {
  return await requestAPI('token').then(async response => {
    if (response.ok) {
      const json = await response.json();
      return json['success'];
    } else {
      console.error(
        'Error getting models',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// POST /token
export async function postApiToken(apiToken: string): Promise<void> {
  return await requestAPI('token', {
    method: 'POST',
    body: JSON.stringify({ token: apiToken })
  }).then(response => {
    if (response.ok) {
      response.json().then(json => {
        const msg = 'IBM Quantum API Token saved';
        Notification.info(`Qiskit Code Assistant:\n${msg}`, {
          autoClose: false
        });
        console.debug(msg);
      });
    } else {
      console.error(
        'Error submitting IBM Quantum API Token',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// GET /models
export async function getModels(): Promise<IModelInfo[]> {
  return await requestAPI('models').then(async response => {
    if (response.ok) {
      const json = await response.json();
      console.debug('models list:', json);
      return json['models'];
    } else {
      notifyInvalid(response);
      console.error(
        'Error getting models',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// GET /model/{model_id}
export async function getModel(model_id: string): Promise<IModelInfo> {
  return await requestAPI(`model/${model_id}`).then(async response => {
    if (response.ok) {
      const model = await response.json();
      console.debug('model:', model);
      return model;
    } else {
      notifyInvalid(response);
      console.error(
        'Error getting model',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// GET /model/{model_id}/disclaimer
export async function getModelDisclaimer(
  model_id: string
): Promise<IModelDisclaimer> {
  return await requestAPI(`model/${model_id}/disclaimer`).then(
    async response => {
      if (response.ok) {
        return await response.json();
      } else {
        notifyInvalid(response);
        console.error(
          'Error getting disclaimer',
          response.status,
          response.statusText
        );
        throw Error(response.statusText);
      }
    }
  );
}

// POST /disclaimer/{disclaimer_id}/acceptance
export async function postDisclaimerAccept(
  disclaimer_id: string,
  model: string
): Promise<IResponseMessage> {
  return await requestAPI(`disclaimer/${disclaimer_id}/acceptance`, {
    method: 'POST',
    body: JSON.stringify({ model, accepted: true })
  }).then(async response => {
    if (response.ok) {
      return await response.json();
    } else {
      notifyInvalid(response);
      console.error(
        'Error accepting disclaimer',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// POST /model/{model_id}/prompt
export async function postModelPrompt(
  model_id: string,
  input: string
): Promise<IModelPromptResponse> {
  return await requestAPI(`model/${model_id}/prompt`, {
    method: 'POST',
    body: JSON.stringify({ input })
  }).then(async response => {
    if (response.ok) {
      const promptRes = await response.json();
      console.debug('prompt:', promptRes);
      return promptRes;
    } else {
      notifyInvalid(response);
      console.error(
        'Error sending prompt',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// POST /model/{model_id}/prompt
/**
 * Helper function to parse and validate a single SSE data line
 * @param line The trimmed line to parse
 * @param context Context for error logging (e.g., 'line' or 'final buffer')
 * @returns Parsed data object or null if invalid
 */
function parseSSEDataLine(
  line: string,
  context: { buffer?: string } = {}
): IModelPromptResponse | null {
  if (!line.startsWith(STREAM_DATA_PREFIX)) {
    return null;
  }

  try {
    const jsonStr = line.substring(STREAM_DATA_PREFIX.length);
    if (!jsonStr) {
      return null;
    }

    const data = JSON.parse(jsonStr);

    // Check if this is an error message from the backend
    if (data.error) {
      console.error(`Backend streaming error: ${data.error}`, data);
      Notification.error(`Qiskit Code Assistant Error:\n${data.error}`, {
        autoClose: 5000
      });
      // Continue streaming despite errors unless it's critical
      if (data.type !== 'chunk_processing_error') {
        throw new Error(data.error);
      }
      return null;
    }

    return data;
  } catch (error) {
    // JSON parsing errors - log with more context
    console.error(`Error parsing JSON chunk: ${error}`, {
      line: line.substring(0, 100),
      ...context
    });
    // Re-throw non-parsing errors
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return null;
  }
}

export async function* postModelPromptStreaming(
  model_id: string,
  input: string,
  signal?: AbortSignal
): AsyncGenerator<IModelPromptResponse> {
  const response = await requestAPIStreaming(
    `model/${model_id}/prompt`,
    {
      method: 'POST',
      body: JSON.stringify({ input, stream: true })
    },
    signal
  );

  let buffer = '';
  for await (const chunk of response) {
    // Check if signal was aborted
    if (signal?.aborted) {
      console.debug('Stream processing aborted by signal');
      break;
    }

    // Accumulate chunks in buffer to handle partial JSON
    buffer += chunk;

    // Protect against unbounded buffer growth
    if (buffer.length > MAX_BUFFER_SIZE) {
      const error = `Stream buffer exceeded maximum size (${MAX_BUFFER_SIZE} bytes)`;
      console.error(error);
      Notification.error(`Qiskit Code Assistant Error:\n${error}`, {
        autoClose: 5000
      });
      throw new Error(error);
    }

    const lines = buffer.split('\n');

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      const trimmed = line.trim();
      const data = parseSSEDataLine(trimmed, { buffer });
      if (data) {
        yield data;
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    const data = parseSSEDataLine(trimmed, { buffer: trimmed });
    if (data) {
      yield data;
    }
  }
}

// POST /prompt/{prompt_id}/acceptance
export async function postModelPromptAccept(
  prompt_id: string
): Promise<IResponseMessage> {
  return await requestAPI(`prompt/${prompt_id}/acceptance`, {
    method: 'POST',
    body: JSON.stringify({ accepted: true })
  }).then(async response => {
    if (response.ok) {
      return await response.json();
    } else {
      notifyInvalid(response);
      console.error(
        'Error accepting prompt',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// POST /feedback
export async function postFeedback(
  model_id?: string,
  prompt_id?: string,
  positive_feedback?: boolean,
  comment?: string,
  input?: string,
  output?: string
): Promise<IFeedbackResponse> {
  return await requestAPI('feedback', {
    method: 'POST',
    body: JSON.stringify({
      model_id,
      prompt_id,
      positive_feedback,
      comment,
      input,
      output
    })
  }).then(async response => {
    if (response.ok) {
      return await response.json();
    } else {
      notifyInvalid(response);
      console.error(
        'Error sending feedback',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// GET /credentials
export async function getCredentials(): Promise<{
  credentials: Array<{
    name: string;
    is_selected: boolean;
  }>;
  selected_credential: string | null;
  using_env_var: boolean;
  never_prompt: boolean;
  has_prompted: boolean;
}> {
  return await requestAPI('credentials').then(async response => {
    if (response.ok) {
      const json = await response.json();
      console.debug('credentials list:', json);
      return json;
    } else {
      console.error(
        'Error getting credentials',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// POST /credentials
export async function postSelectCredential(
  credentialName: string
): Promise<void> {
  return await requestAPI('credentials', {
    method: 'POST',
    body: JSON.stringify({ credential_name: credentialName })
  }).then(response => {
    if (response.ok) {
      response.json().then(json => {
        const msg = `Switched to credential: ${json.selected_credential}`;
        Notification.info(`Qiskit Code Assistant:\n${msg}`, {
          autoClose: 3000
        });
        console.debug(msg);
      });
    } else {
      console.error(
        'Error selecting credential',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// PUT /credentials - Update state flags
export async function putCredentialFlags(flags: {
  never_prompt?: boolean;
  has_prompted?: boolean;
}): Promise<void> {
  return await requestAPI('credentials', {
    method: 'PUT',
    body: JSON.stringify(flags)
  }).then(response => {
    if (response.ok) {
      console.debug('Credential flags updated:', flags);
    } else {
      console.error(
        'Error updating credential flags',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}

// DELETE /credentials
export async function deleteClearCredentialSelection(): Promise<void> {
  return await requestAPI('credentials', {
    method: 'DELETE'
  }).then(response => {
    if (response.ok) {
      response.json().then(json => {
        Notification.info(
          `Qiskit Code Assistant:\n${json.message}`,
          { autoClose: 3000 }
        );
        console.debug('Credential selection cleared');
      });
    } else {
      console.error(
        'Error clearing credential selection',
        response.status,
        response.statusText
      );
      throw Error(response.statusText);
    }
  });
}
