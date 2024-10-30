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

import { InputDialog, Notification } from '@jupyterlab/apputils';
import { ReactWidget } from '@jupyterlab/ui-components';

import { postFeedback } from './api';
import { getCurrentModel } from './modelHandler';
import { lastPrompt } from '../QiskitCompletionProvider';
import { feedbackIcon } from '../utils/icons';
import { IFeedbackResponse } from '../utils/schema';

const DIALOG_TITLE = 'Qiskit Code Assistant Feedback';

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
  return InputDialog.getText({
    title: DIALOG_TITLE,
    label: prompt ? lastPrompt?.items[0] : undefined
  }).then(result => {
    // send feedback
    if (result.button.accept) {
      sendFeedback(
        getCurrentModel()?._id,
        prompt ? lastPrompt?.prompt_id : undefined,
        undefined,
        result.value || undefined
      );
    }
  });
}

function sendFeedback(
  model_id?: string,
  prompt_id?: string,
  positive_feedback?: boolean,
  comment?: string
) {
  console.log(
    `model_id: ${model_id}`,
    `prompt_id: ${prompt_id}`,
    `positive_feedback: ${positive_feedback}`,
    `comment: ${comment}`
  );
  postFeedback(model_id, prompt_id, positive_feedback, comment).then(
    (response: IFeedbackResponse) => {
      Notification.info(`Qiskit Code Assistant:\n${response['message']}`, {
        autoClose: false
      });
    }
  );
}
