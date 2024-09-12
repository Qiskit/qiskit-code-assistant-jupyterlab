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

import { getModels } from './api';
import { StatusBarWidget } from '../StatusBarWidget';
import { IModelInfo } from '../utils/schema';

let modelsList: IModelInfo[] = [];
let currentModel: IModelInfo | undefined = undefined;

export function getModelsList(): IModelInfo[] {
  return modelsList;
}

export function getCurrentModel(): IModelInfo | undefined {
  return currentModel;
}

export function setCurrentModel(model?: IModelInfo): void {
  currentModel = modelsList.find(m => m._id === model?._id);
  StatusBarWidget.widget?.refreshStatusBar();
}

export async function refreshModelsList(): Promise<void> {
  return await getModels()
    .then(models => {
      modelsList = models;
      currentModel =
        modelsList.find(m => m._id === currentModel?._id) || models?.[0];
      StatusBarWidget.widget?.refreshStatusBar();
    })
    .catch(reason => {
      throw new Error(reason);
    });
}
