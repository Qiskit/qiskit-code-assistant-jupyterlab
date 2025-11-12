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

export class Widget {
  node: HTMLElement;
  private _classList: Set<string> = new Set();

  constructor() {
    this.node = document.createElement('div');
  }

  addClass(className: string): void {
    this._classList.add(className);
    this.node.classList.add(className);
  }

  removeClass(className: string): void {
    this._classList.delete(className);
    this.node.classList.remove(className);
  }

  hasClass(className: string): boolean {
    return this._classList.has(className);
  }

  protected onAfterAttach(msg: any): void {}
  protected onBeforeDetach(msg: any): void {}
}
