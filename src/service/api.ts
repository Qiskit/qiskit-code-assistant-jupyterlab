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

import { requestAPI } from '../utils/handler';
import {
  IModelDisclaimer,
  IModelInfo,
  IModelPromptResponse,
  IResponseMessage
} from '../utils/schema';

const AUTH_ERROR_CODES = [401, 403, 422];

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
export async function postServiceUrl(newUrl: string): Promise<void> {
  return await requestAPI('service', {
    method: 'POST',
    body: JSON.stringify({ url: newUrl })
  }).then(response => {
    if (response.ok) {
      response.json().then(json => {
        console.debug('Updated service URL:', json.url);
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
