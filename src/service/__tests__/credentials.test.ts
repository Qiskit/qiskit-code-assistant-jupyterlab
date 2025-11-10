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

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  checkAndPromptForCredentialSelection,
  checkAndSelectCredential,
  selectCredential,
  clearCredentialSelection
} from '../credentials';
import * as api from '../api';
import * as modelHandler from '../modelHandler';
import * as token from '../token';
import { showDialog, InputDialog, Dialog } from '@jupyterlab/apputils';

// Mock dependencies
jest.mock('../api');
jest.mock('../modelHandler');
jest.mock('../token');
jest.mock('@jupyterlab/apputils', () => ({
  showDialog: jest.fn(),
  InputDialog: {
    getItem: jest.fn()
  },
  Dialog: {
    okButton: jest.fn((opts?: any) => ({
      accept: true,
      label: opts?.label || 'OK'
    })),
    warnButton: jest.fn((opts?: any) => ({
      accept: true,
      label: opts?.label || 'Warning'
    })),
    cancelButton: jest.fn(() => ({ accept: false, label: 'Cancel' })),
    createButton: jest.fn((opts?: any) => ({
      accept: false,
      label: opts?.label || 'Create'
    }))
  }
}));

const mockGetCredentials = api.getCredentials as jest.MockedFunction<
  typeof api.getCredentials
>;
const mockPostSelectCredential =
  api.postSelectCredential as jest.MockedFunction<
    typeof api.postSelectCredential
  >;
const mockDeleteClearCredentialSelection =
  api.deleteClearCredentialSelection as jest.MockedFunction<
    typeof api.deleteClearCredentialSelection
  >;
const mockPutCredentialFlags = api.putCredentialFlags as jest.MockedFunction<
  typeof api.putCredentialFlags
>;
const mockRefreshModelsList =
  modelHandler.refreshModelsList as jest.MockedFunction<
    typeof modelHandler.refreshModelsList
  >;
const mockUpdateAPIToken = token.updateAPIToken as jest.MockedFunction<
  typeof token.updateAPIToken
>;
const mockShowDialog = showDialog as jest.MockedFunction<typeof showDialog>;
const mockGetItem = InputDialog.getItem as jest.MockedFunction<
  typeof InputDialog.getItem
>;

describe('Credentials Service', () => {
  const mockCredentials = [
    { name: 'credential-1', url: 'https://url1', token: 'token1' },
    { name: 'credential-2', url: 'https://url2', token: 'token2' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndPromptForCredentialSelection', () => {
    it('should return false when never_prompt flag is set', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: true,
        has_prompted: false
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should return false when already prompted in session', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: true
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should return false when using environment variable', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: true,
        never_prompt: false,
        has_prompted: false
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should return false when no credentials exist', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should return false when only one credential exists', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [mockCredentials[0]],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should return false when credential already selected', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should prompt user when multiple credentials and none selected', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { label: 'Select Credential', accept: true }
      } as any);

      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'credential-1'
      });

      mockPostSelectCredential.mockResolvedValue(undefined as any);
      mockRefreshModelsList.mockResolvedValue(undefined);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(true);
      expect(mockShowDialog).toHaveBeenCalled();
      expect(mockPutCredentialFlags).toHaveBeenCalledWith({
        has_prompted: true
      });
    });

    it('should handle "Enter Token Manually" button', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { label: 'Enter Token Manually', accept: true }
      } as any);

      mockUpdateAPIToken.mockResolvedValue(undefined);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockUpdateAPIToken).toHaveBeenCalled();
    });

    it('should handle "Don\'t Ask Again" button', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { label: "Don't Ask Again", accept: false }
      } as any);

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
      expect(mockPutCredentialFlags).toHaveBeenCalledWith({
        never_prompt: true
      });
    });

    it('should handle errors gracefully', async () => {
      mockGetCredentials.mockRejectedValue(new Error('API error'));

      const result = await checkAndPromptForCredentialSelection();

      expect(result).toBe(false);
    });
  });

  describe('checkAndSelectCredential', () => {
    it('should return when no credentials exist', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      await checkAndSelectCredential();

      expect(mockPostSelectCredential).not.toHaveBeenCalled();
    });

    it('should auto-select when only one credential exists', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [mockCredentials[0]],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockPostSelectCredential.mockResolvedValue(undefined as any);

      await checkAndSelectCredential();

      expect(mockPostSelectCredential).toHaveBeenCalledWith('credential-1');
    });

    it('should not reselect when credential already selected', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [mockCredentials[0]],
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      await checkAndSelectCredential();

      expect(mockPostSelectCredential).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockGetCredentials.mockRejectedValue(new Error('API error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await checkAndSelectCredential();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking credentials:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('selectCredential', () => {
    it('should warn when environment variable is set', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: true,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: true, label: 'Understood' }
      } as any);

      await selectCredential();

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Environment Variable Override'
        })
      );
    });

    it('should warn when no credentials found', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: [],
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: true, label: 'OK' }
      } as any);

      await selectCredential();

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No Credentials Found'
        })
      );
    });

    it('should select credential and refresh models', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'credential-2'
      });

      mockPostSelectCredential.mockResolvedValue(undefined as any);
      mockRefreshModelsList.mockResolvedValue(undefined);

      await selectCredential(true);

      expect(mockPostSelectCredential).toHaveBeenCalledWith('credential-2');
      expect(mockRefreshModelsList).toHaveBeenCalled();
    });

    it('should not call API when same credential selected', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'credential-1 (current)'
      });

      await selectCredential(true);

      expect(mockPostSelectCredential).not.toHaveBeenCalled();
      expect(mockRefreshModelsList).not.toHaveBeenCalled();
    });

    it('should handle user cancellation', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockGetItem.mockResolvedValue({
        button: { accept: false, label: 'Cancel' } as any,
        value: null
      });

      await selectCredential(true);

      expect(mockPostSelectCredential).not.toHaveBeenCalled();
    });
  });

  describe('clearCredentialSelection', () => {
    it('should warn when environment variable is set', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: true,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: true, label: 'OK' }
      } as any);

      await clearCredentialSelection();

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Environment Variable Set'
        })
      );
    });

    it('should warn when nothing to clear', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: null,
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: true, label: 'OK' }
      } as any);

      await clearCredentialSelection();

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nothing to Clear'
        })
      );
    });

    it('should clear selection and prompt for new credential', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: true, label: 'Reset' }
      } as any);

      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'credential-2'
      });

      mockDeleteClearCredentialSelection.mockResolvedValue(undefined as any);
      mockPostSelectCredential.mockResolvedValue(undefined as any);
      mockRefreshModelsList.mockResolvedValue(undefined);

      await clearCredentialSelection();

      expect(mockDeleteClearCredentialSelection).toHaveBeenCalled();
      expect(mockGetItem).toHaveBeenCalled();
    });

    it('should handle user cancellation', async () => {
      mockGetCredentials.mockResolvedValue({
        credentials: mockCredentials,
        selected_credential: 'credential-1',
        using_env_var: false,
        never_prompt: false,
        has_prompted: false
      } as any);

      mockShowDialog.mockResolvedValue({
        button: { accept: false, label: 'Cancel' }
      } as any);

      await clearCredentialSelection();

      expect(mockDeleteClearCredentialSelection).not.toHaveBeenCalled();
    });
  });
});
