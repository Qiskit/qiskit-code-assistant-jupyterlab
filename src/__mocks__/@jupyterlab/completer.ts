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

export const InlineCompletionTriggerKind = {
  Automatic: 0,
  Invoke: 1
};

export const CompletionHandler = {
  IRequest: {} as any,
  ICompletionItemsReply: {} as any,
  ICompletionItem: {} as any
};

export interface ICompletionContext {
  widget: any;
  triggerKind?: number;
}

export interface ICompletionProvider {
  identifier: string;
  rank?: number;
  fetch(request: any, context: ICompletionContext): Promise<any>;
  isApplicable(context: ICompletionContext): Promise<boolean>;
}

export interface IInlineCompletionContext extends ICompletionContext {
  triggerKind: number;
}

export interface IInlineCompletionItem {
  insertText: string;
  isIncomplete?: boolean;
  token?: string;
}

export interface IInlineCompletionList {
  items: IInlineCompletionItem[];
}

export interface IInlineCompletionProvider {
  identifier: string;
  name: string;
  icon?: any;
  schema?: any;
  fetch(
    request: any,
    context: IInlineCompletionContext
  ): Promise<IInlineCompletionList>;
  stream?(token: string): AsyncGenerator<any>;
  isApplicable(context: ICompletionContext): Promise<boolean>;
}

export interface ICompletionProviderManager {}
