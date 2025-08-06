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

import { postModelPrompt, postModelPromptStreaming } from './api';
import { showDisclaimer } from './disclaimer';
import { getCurrentModel } from './modelHandler';
import { checkAPIToken } from './token';
import { StatusBarWidget } from '../StatusBarWidget';
import { ICompletionReturn, IModelPromptResponse } from '../utils/schema';

export const CHAR_LIMIT = 4_000;


function getGeneratedText(json: any): string {
  return json?.generated_text ?? json?.results[0].generated_text ?? "";
}

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
        prompt_id: response.prompt_id,
        input: requestText
      };
    }
  );
}

async function *promptPromiseStreaming(
  model: string,
  requestText: string
): AsyncGenerator<ICompletionReturn> {
  // Show loading icon in status bar
  StatusBarWidget.widget.setLoadingStatus();

  const responseData = postModelPromptStreaming(model, requestText);

  for await (let chunk of responseData) {
      const item: ICompletionReturn = {
        items: [getGeneratedText(chunk)],
        prompt_id: chunk.prompt_id,
        input: requestText
      };

      yield item;
  }
}

export async function autoComplete(text: string): Promise<ICompletionReturn> {
  const emptyReturn: ICompletionReturn = {
    items: [],
    prompt_id: '',
    input: ''
  };

  return await checkAPIToken()
    .then(async () => {
      const startingOffset = Math.max(0, text.length - CHAR_LIMIT);
      const requestText = text.slice(startingOffset, text.length);
      const model = getCurrentModel();

      if (model === undefined) {
        console.error('Failed to send prompt', 'No model selected');
        return emptyReturn;
      } else if (model.disclaimer?.accepted) {
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
    })
    .finally(() => {
      // Remove loading icon from status bar
      StatusBarWidget.widget.refreshStatusBar();
    });
}

export async function *autoCompleteStreaming(text: string): AsyncGenerator<ICompletionReturn> {
  const emptyReturn: ICompletionReturn = {
    items: [],
    prompt_id: '',
    input: ''
  };

  try {
    await checkAPIToken()

    const startingOffset = Math.max(0, text.length - CHAR_LIMIT);
    const requestText = text.slice(startingOffset, text.length);
    const model = getCurrentModel();

    if (model === undefined) {
      console.error('Failed to send prompt', 'No model selected');
      yield emptyReturn;
    } else if (model.disclaimer?.accepted) {
      const response = await promptPromiseStreaming(model._id, requestText);

      for await (let chunk of response) {
        yield chunk;
      }
    } else {
      const accepted = await showDisclaimer(model._id)
      if (accepted) {
        const response = await promptPromiseStreaming(model._id, requestText);

        for await (let chunk of response) {
          yield chunk;
        }
      } else {
        console.error('Disclaimer not accepted');
        yield emptyReturn;
      }
    }
  } catch(e) {
    console.error('Failed to send prompt', e);
    return emptyReturn;
  } finally {
    // Remove loading icon from status bar
    StatusBarWidget.widget.refreshStatusBar();
  }
}
