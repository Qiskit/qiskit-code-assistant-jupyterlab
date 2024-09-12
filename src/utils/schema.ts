/*
 * Copyright 2024 IBM Corporation
 *
 * Licensed under the Apache License; Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing; software
 * distributed under the License is distributed on an "AS IS" BASIS;
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND; either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface IModelSpecialTokens {
  start_token: string;
  middle_token: string;
  end_token: string;
}
export interface IModelEndpoints {
  generation_endpoint: string;
  moderation_endpoint: string;
}

export interface IModelModerations {
  hap: number;
  social_bias: number;
}

export interface IModelParameters {
  temperature: number;
  max_new_tokens: number;
}

export interface IModelInfo {
  _id: string;
  delimiting_tokens: IModelSpecialTokens;
  disclaimer: { accepted: boolean };
  display_name: string;
  doc_link: string;
  endpoints: IModelEndpoints;
  license: { name: string; link: string };
  model_id: string;
  moderations: IModelModerations;
  parameters: IModelParameters;
  prompt_type: number;
  token_limit: number;
}

export interface IModelsList {
  models: IModelInfo[];
}

export interface IModelPromptResults {
  generated_text: string;
  generated_token_count: number;
  input_token_count: number;
  stop_reason: string;
}

export interface IModelPromptResponse {
  results: IModelPromptResults[];
  prompt_id: string;
  created_at: string;
  model_id: string;
}

export interface IModelDisclaimer {
  _id: string;
  version: string;
  title: string;
  body: string;
  model: string;
  accepted: boolean;
}

export interface IResponseMessage {
  success: boolean;
}

export interface ICompletionReturn {
  items: string[];
  prompt_id: string;
}
