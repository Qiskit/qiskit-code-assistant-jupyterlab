/*
 * Copyright 2025 IBM Corporation
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

export namespace LabIcon {
  export interface ILabIcon {
    name: string;
    svgstr: string;
  }
}

export class LabIcon {
  name: string;
  svgstr: string;

  constructor(options: { name: string; svgstr: string }) {
    this.name = options.name;
    this.svgstr = options.svgstr;
  }
}

export const refreshIcon = new LabIcon({
  name: 'ui-components:refresh',
  svgstr: '<svg>refresh</svg>'
});
