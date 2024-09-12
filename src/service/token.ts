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

import { Dialog, InputDialog } from '@jupyterlab/apputils';

import { getAPIToken, postApiToken } from './api';
import { refreshModelsList } from './modelHandler';

export async function checkAPIToken(): Promise<void> {
  const apiToken = await getAPIToken();
  if (!apiToken) {
    return await updateAPIToken();
  }
}

export async function updateAPIToken(): Promise<void> {
  await InputDialog.getPassword({
    title: 'Enter your API token from quantum.ibm.com',
    label:
      'In order to use Qiskit Code Assistant you need a IBM Quantum API Token'
  })
    .then(async (result: Dialog.IResult<string>) => {
      if (result.button.accept && result.value) {
        return await postApiToken(result.value).then(async () => {
          try {
            return await refreshModelsList();
          } catch (reason) {
            console.error('Failed to load models list', reason);
          }
        });
      } else {
        throw Error('API token not set');
      }
    })
    .catch(() => {
      throw Error('API token not set');
    });
}
