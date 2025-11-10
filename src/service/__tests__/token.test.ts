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

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { checkAPIToken, updateAPIToken } from '../token';
import * as api from '../api';
import * as modelHandler from '../modelHandler';
import * as credentials from '../credentials';
import { InputDialog, Dialog } from '@jupyterlab/apputils';

// Mock dependencies
jest.mock('../api');
jest.mock('../modelHandler');
jest.mock('../credentials');
jest.mock('@jupyterlab/apputils', () => ({
  InputDialog: {
    getPassword: jest.fn()
  },
  Dialog: {}
}));

const mockGetAPIToken = api.getAPIToken as jest.MockedFunction<
  typeof api.getAPIToken
>;
const mockPostApiToken = api.postApiToken as jest.MockedFunction<
  typeof api.postApiToken
>;
const mockRefreshModelsList =
  modelHandler.refreshModelsList as jest.MockedFunction<
    typeof modelHandler.refreshModelsList
  >;
const mockGetPassword = InputDialog.getPassword as jest.MockedFunction<
  typeof InputDialog.getPassword
>;
const mockGetCredentials = api.getCredentials as jest.MockedFunction<
  typeof api.getCredentials
>;
const mockCheckAndSelectCredential =
  credentials.checkAndSelectCredential as jest.MockedFunction<
    typeof credentials.checkAndSelectCredential
  >;

describe('Token Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAPIToken', () => {
    it('should return void when API token exists', async () => {
      mockGetAPIToken.mockResolvedValue(true);

      await checkAPIToken();

      expect(mockGetAPIToken).toHaveBeenCalled();
    });

    it('should prompt for credential selection when multiple credentials exist', async () => {
      mockGetAPIToken.mockResolvedValue(false);
      mockGetCredentials.mockResolvedValue({
        credentials: [
          { name: 'cred1', url: 'url1', token: 'token1' },
          { name: 'cred2', url: 'url2', token: 'token2' }
        ],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);
      mockCheckAndSelectCredential.mockResolvedValue(undefined);

      await checkAPIToken();

      expect(mockGetAPIToken).toHaveBeenCalled();
      expect(mockGetCredentials).toHaveBeenCalled();
      expect(mockCheckAndSelectCredential).toHaveBeenCalled();
    });

    it('should prompt for manual token when no credentials found', async () => {
      mockGetAPIToken.mockResolvedValue(false);
      mockGetCredentials.mockRejectedValue(new Error('No credentials'));
      mockGetPassword.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'test-token'
      });
      mockPostApiToken.mockResolvedValue(undefined);
      mockRefreshModelsList.mockResolvedValue(undefined);

      await checkAPIToken();

      expect(mockGetAPIToken).toHaveBeenCalled();
      expect(mockGetPassword).toHaveBeenCalled();
    });

    it('should prompt for manual token when only one credential exists', async () => {
      mockGetAPIToken.mockResolvedValue(false);
      mockGetCredentials.mockResolvedValue({
        credentials: [{ name: 'cred1', url: 'url1', token: 'token1' }],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);
      mockGetPassword.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'test-token'
      });
      mockPostApiToken.mockResolvedValue(undefined);
      mockRefreshModelsList.mockResolvedValue(undefined);

      await checkAPIToken();

      expect(mockGetAPIToken).toHaveBeenCalled();
      expect(mockGetPassword).toHaveBeenCalled();
    });
  });

  describe('updateAPIToken', () => {
    it('should successfully update API token and refresh models', async () => {
      mockGetPassword.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'new-token-123'
      });
      mockPostApiToken.mockResolvedValue(undefined);
      mockRefreshModelsList.mockResolvedValue(undefined);

      await updateAPIToken();

      expect(mockGetPassword).toHaveBeenCalledWith({
        title: 'Enter your API token from quantum.cloud.ibm.com',
        label:
          'In order to use Qiskit Code Assistant you need a IBM Quantum API Token'
      });
      expect(mockPostApiToken).toHaveBeenCalledWith('new-token-123');
      expect(mockRefreshModelsList).toHaveBeenCalled();
    });

    it('should throw error when user cancels dialog', async () => {
      mockGetPassword.mockResolvedValue({
        button: { accept: false, label: 'Cancel' } as any,
        value: ''
      });

      await expect(updateAPIToken()).rejects.toThrow('API token not set');
      expect(mockPostApiToken).not.toHaveBeenCalled();
      expect(mockRefreshModelsList).not.toHaveBeenCalled();
    });

    it('should throw error when user provides empty token', async () => {
      mockGetPassword.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: ''
      });

      await expect(updateAPIToken()).rejects.toThrow('API token not set');
      expect(mockPostApiToken).not.toHaveBeenCalled();
    });

    it('should handle refresh models failure gracefully', async () => {
      mockGetPassword.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'new-token'
      });
      mockPostApiToken.mockResolvedValue(undefined);
      mockRefreshModelsList.mockRejectedValue(new Error('Network error'));

      // Should still succeed even if refreshModelsList fails
      await updateAPIToken();

      expect(mockPostApiToken).toHaveBeenCalledWith('new-token');
      expect(mockRefreshModelsList).toHaveBeenCalled();
    });

    it('should throw error when dialog is rejected', async () => {
      mockGetPassword.mockRejectedValue(new Error('Dialog cancelled'));

      await expect(updateAPIToken()).rejects.toThrow('API token not set');
    });
  });
});
