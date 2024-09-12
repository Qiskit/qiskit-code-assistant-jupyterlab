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

import React from 'react';

import { Dialog, showDialog } from '@jupyterlab/apputils';

import { getModelDisclaimer, postDisclaimerAccept } from './api';
import { refreshModelsList } from './modelHandler';
import { IResponseMessage } from '../utils/schema';

export async function showDisclaimer(model_id: string): Promise<boolean> {
  return await getModelDisclaimer(model_id).then(async disclaimerRes => {
    if (disclaimerRes.accepted) {
      return disclaimerRes.accepted;
    }

    const bodyHtml = { __html: disclaimerRes.body };

    return await showDialog({
      title: disclaimerRes.title,
      body: <div dangerouslySetInnerHTML={bodyHtml} />,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Accept' })]
    }).then(async (result: any) => {
      // Do nothing if the cancel button is pressed
      if (result.button.accept) {
        return await postDisclaimerAccept(disclaimerRes._id, model_id).then(
          async (res: IResponseMessage) => {
            return await refreshModelsList().then(() => {
              return res.success;
            });
          }
        );
      } else {
        return false;
      }
    });
  });
}
