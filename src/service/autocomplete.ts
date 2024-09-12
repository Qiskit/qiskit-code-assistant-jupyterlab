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

import { getModel, postModelPrompt } from './api';
import { showDisclaimer } from './disclaimer';
import { getCurrentModel } from './modelHandler';
import { checkAPIToken } from './token';
import { StatusBarWidget } from '../StatusBarWidget';
import { ICompletionReturn, IModelPromptResponse } from '../utils/schema';

export const CHAR_LIMIT = 4_000;

async function promptPromise(
  model: string,
  requestText: string
): Promise<ICompletionReturn> {
  // Show loading icon in status bar
  StatusBarWidget.widget.setLoadingStatus();

  return postModelPrompt(model, requestText).then(
    (response: IModelPromptResponse) => {
      const items: string[] = [];
      response.results.map(results => items.push(results.generated_text));
      return {
        items,
        prompt_id: response.prompt_id
      };
    }
  );
}

export async function autoComplete(text: string): Promise<ICompletionReturn> {
  const emptyReturn: ICompletionReturn = { items: [], prompt_id: '' };

  return await checkAPIToken()
    .then(async () => {
      const startingOffset = Math.max(0, text.length - CHAR_LIMIT);
      const requestText = text.slice(startingOffset, text.length);
      const model = getCurrentModel();

      return await getModel(model?._id || '')
        .then(async model => {
          if (model.disclaimer?.accepted) {
            return await promptPromise(model._id, requestText);
          } else {
            return await showDisclaimer(model._id).then(async accepted => {
              if (accepted) {
                return await promptPromise(model._id, requestText);
              } else {
                console.error('Disclaimer not accepted');
                return emptyReturn;
              }
            });
          }
        })
        .catch(reason => {
          console.error('Failed to send prompt', reason);
          return emptyReturn;
        });
    })
    .catch(reason => {
      console.error('Failed to send prompt', reason);
      return emptyReturn;
    })
    .finally(() => {
      // Remove loading icon from status bar
      StatusBarWidget.widget.refreshStatusBar();
    });
}
