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

import { Dialog, Notification } from '@jupyterlab/apputils';
import { ReactWidget } from '@jupyterlab/ui-components';

import { postFeedback } from './api';
import { getCurrentModel } from './modelHandler';
import { lastPrompt } from '../QiskitCompletionProvider';
import { feedbackIcon } from '../utils/icons';
import { IFeedbackForm, IFeedbackResponse } from '../utils/schema';

const toBool = (bool?: string): boolean | undefined => {
  switch (bool) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return undefined;
  }
};

export function getFeedbackStatusBarWidget() {
  const feedbackButton = ReactWidget.create(
    <div
      className="jp-qiskit-code-assistant-feedback"
      title="Give feedback for the Qiskit Code Assistant"
      onClick={() => getFeedback(false)}
    >
      <feedbackIcon.react
        stylesheet="statusBar"
        tag="span"
        top="2px"
        verticalAlign="middle"
      />
    </div>
  );

  feedbackButton.addClass('jp-mod-highlighted');

  return feedbackButton;
}

export function getFeedback(prompt: boolean = true) {
  const model_id = getCurrentModel()?._id;
  const prompt_id = prompt ? lastPrompt?.prompt_id : undefined;
  const prompt_input = prompt ? lastPrompt?.input : undefined;
  const prompt_output = prompt ? lastPrompt?.items[0] : undefined;

  const dialog = new Dialog({
    title: 'Qiskit Code Assistant Feedback',
    body: getFeedbackBodyWidget(prompt_output),
    buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Submit' })],
    focusNodeSelector: '.jp-qiskit-code-assistant-feedback-form textarea'
  });

  const dialogHandleEvent = dialog.handleEvent;
  dialog.handleEvent = (event: Event) => {
    if (
      event.type === 'keydown' &&
      (event as KeyboardEvent).code === 'Enter' &&
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }
    dialogHandleEvent.call(dialog, event);
  };

  return dialog.launch().then(result => {
    if (
      result.button.accept &&
      (result.value?.positive_feedback || result.value?.comment)
    ) {
      postFeedback(
        model_id,
        prompt_id,
        toBool(result.value?.positive_feedback),
        result.value?.comment,
        prompt_input,
        prompt_output
      ).then((response: IFeedbackResponse) => {
        Notification.info(`Qiskit Code Assistant:\n${response['message']}`, {
          autoClose: 5000
        });
      });
    }
  });
}

function getFeedbackBodyWidget(
  prompt?: string
): Dialog.IBodyWidget<IFeedbackForm> {
  const bodyWidget = ReactWidget.create(
    <>
      {!!prompt && (
        <>
          <b>Completion</b>
          <pre>{prompt.trim()}</pre>
        </>
      )}
      <form>
        {!!prompt && (
          <p>
            How helpful was this completion? &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <label>
              <input type="radio" name="positive_feedback" value="true" />
              <span className="positive-feedback">&#128077;</span>
            </label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <label>
              <input type="radio" name="positive_feedback" value="false" />
              <span className="positive-feedback">&#128078;</span>
            </label>
          </p>
        )}
        <p>
          <label>
            <p>
              {prompt
                ? 'Additional feedback (Optional)'
                : 'Please share your experience with Qiskit Code Assistant'}
            </p>
            <textarea name="comment"></textarea>
          </label>
        </p>
      </form>
    </>
  ) as Dialog.IBodyWidget<IFeedbackForm>;

  bodyWidget.addClass('jp-qiskit-code-assistant-feedback-form');
  if (prompt) {
    bodyWidget.addClass('jp-qiskit-code-assistant-feedback-prompt');
  } else {
    bodyWidget.addClass('jp-qiskit-code-assistant-feedback-general');
  }

  bodyWidget.getValue = (): IFeedbackForm => {
    const form = bodyWidget.node.querySelector('form');
    const formData = new FormData(form ? form : undefined);
    const positive_feedback = formData.get('positive_feedback') as string;
    const comment = formData.get('comment') as string;

    return {
      positive_feedback: positive_feedback ? positive_feedback : undefined,
      comment: comment ? comment : undefined
    };
  };

  return bodyWidget;
}
