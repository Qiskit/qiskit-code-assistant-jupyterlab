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

// Track active non-streaming requests to prevent concurrent calls
let activeRequestController: AbortController | null = null;

function getGeneratedText(json: any): string {
  return json?.generated_text ?? json?.results[0].generated_text ?? '';
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

async function* promptPromiseStreaming(
  model: string,
  requestText: string,
  signal?: AbortSignal
): AsyncGenerator<ICompletionReturn> {
  // Show loading icon in status bar
  StatusBarWidget.widget.setLoadingStatus();

  const responseData = postModelPromptStreaming(model, requestText, signal);

  for await (const chunk of responseData) {
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

  // Cancel any previous in-flight request
  if (activeRequestController) {
    console.debug('Cancelling previous non-streaming request before starting new one');
    activeRequestController.abort();
    // Clean up the loading status from the cancelled request
    StatusBarWidget.widget.stopLoadingStatus();
  }

  // Create new AbortController for this request
  const requestController = new AbortController();
  activeRequestController = requestController;

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
      // Don't log errors for aborted requests
      if (reason instanceof Error && reason.name === 'AbortError') {
        console.debug('Non-streaming request was cancelled');
      } else {
        console.error('Failed to send prompt', reason);
      }
      return emptyReturn;
    })
    .finally(() => {
      // Only clean up if this is still the active request
      if (activeRequestController === requestController) {
        activeRequestController = null;
        // Remove loading icon from status bar
        StatusBarWidget.widget.stopLoadingStatus();
      }
    });
}

export async function* autoCompleteStreaming(
  text: string,
  signal?: AbortSignal
): AsyncGenerator<ICompletionReturn> {
  const emptyReturn: ICompletionReturn = {
    items: [],
    prompt_id: '',
    input: ''
  };

  try {
    await checkAPIToken();

    const startingOffset = Math.max(0, text.length - CHAR_LIMIT);
    const requestText = text.slice(startingOffset, text.length);
    const model = getCurrentModel();

    if (model === undefined) {
      console.error('Failed to send prompt', 'No model selected');
      yield emptyReturn;
      return;
    }

    if (model.disclaimer?.accepted) {
      const response = promptPromiseStreaming(model._id, requestText, signal);

      for await (const chunk of response) {
        yield chunk;
      }
    } else {
      const accepted = await showDisclaimer(model._id);
      if (accepted) {
        const response = promptPromiseStreaming(model._id, requestText, signal);

        for await (const chunk of response) {
          yield chunk;
        }
      } else {
        console.error('Disclaimer not accepted');
        yield emptyReturn;
      }
    }
  } catch (e) {
    console.error('Failed to send prompt', e);
    // Check if error is due to abort - don't yield error in that case
    if (e instanceof Error && e.name === 'AbortError') {
      console.debug('Streaming was cancelled by user');
    } else {
      // For other errors, yield empty return to provide feedback
      yield emptyReturn;
    }
  } finally {
    // Remove loading icon from status bar
    StatusBarWidget.widget.stopLoadingStatus();
  }
}
