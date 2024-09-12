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

import { InputDialog } from '@jupyterlab/apputils';
import { Message } from '@lumino/messaging';
import { refreshIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';

import { showDisclaimer } from './service/disclaimer';
import {
  getCurrentModel,
  getModelsList,
  setCurrentModel
} from './service/modelHandler';
import { checkAPIToken } from './service/token';

export class StatusBarWidget extends Widget {
  static widget: StatusBarWidget;
  private _statusBar: HTMLElement;

  constructor() {
    super();

    const statusBar = document.createElement('div');
    statusBar.title = 'Click to change the model';
    statusBar.classList.add('jp-qiskit-code-assistant-statusbar');
    statusBar.classList.add('jp-StatusBar-GroupItem');
    this.addClass('jp-mod-highlighted');
    this.node.appendChild(statusBar);
    this._statusBar = statusBar;

    this.refreshStatusBar();

    StatusBarWidget.widget = this;
  }

  /**
   * Updates the statusbar
   */
  refreshStatusBar(): void {
    const curentModel = getCurrentModel();

    if (curentModel) {
      this._statusBar.innerHTML =
        'Qiskit Code Assistant: ' + curentModel.display_name;
      this.removeClass('jp-qiskit-code-assistant-statusbar-warn');
    } else {
      this._statusBar.innerHTML = 'Qiskit Code Assistant: No Model Selected';
      this.addClass('jp-qiskit-code-assistant-statusbar-warn');
    }
  }

  setLoadingStatus(): void {
    this._statusBar.innerHTML = this._statusBar.innerHTML + refreshIcon.svgstr;
  }

  async onClick() {
    await checkAPIToken().then(() => {
      const modelsList = getModelsList();
      InputDialog.getItem({
        title: 'Select a Model',
        items: [...modelsList.map(m => m.display_name)]
      }).then(result => {
        if (result.button.accept) {
          const model = modelsList.find(m => m.display_name === result.value);

          if (model) {
            showDisclaimer(model._id).then(accepted => {
              if (accepted) {
                setCurrentModel(model);
              }
            });
          }
        }
      });
    });
  }

  /**
   * Callback when the widget is added to the DOM
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this._statusBar.addEventListener('click', this.onClick.bind(this));
  }

  /**
   * Callback when the widget is removed from the DOM
   */
  protected onBeforeDetach(msg: Message): void {
    this._statusBar.removeEventListener('click', this.onClick.bind(this));
    super.onBeforeDetach(msg);
  }
}
