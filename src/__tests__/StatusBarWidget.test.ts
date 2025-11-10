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
import { StatusBarWidget } from '../StatusBarWidget';
import * as modelHandler from '../service/modelHandler';
import * as token from '../service/token';
import * as disclaimer from '../service/disclaimer';
import * as provider from '../QiskitCompletionProvider';
import { InputDialog } from '@jupyterlab/apputils';
import { IModelInfo } from '../utils/schema';

// Mock dependencies
jest.mock('../service/modelHandler');
jest.mock('../service/token');
jest.mock('../service/disclaimer');
jest.mock('../QiskitCompletionProvider');
jest.mock('@jupyterlab/apputils', () => ({
  InputDialog: {
    getItem: jest.fn()
  }
}));

const mockGetCurrentModel = modelHandler.getCurrentModel as jest.MockedFunction<
  typeof modelHandler.getCurrentModel
>;
const mockGetModelsList = modelHandler.getModelsList as jest.MockedFunction<
  typeof modelHandler.getModelsList
>;
const mockSetCurrentModel = modelHandler.setCurrentModel as jest.MockedFunction<
  typeof modelHandler.setCurrentModel
>;
const mockCheckAPIToken = token.checkAPIToken as jest.MockedFunction<
  typeof token.checkAPIToken
>;
const mockShowDisclaimer = disclaimer.showDisclaimer as jest.MockedFunction<
  typeof disclaimer.showDisclaimer
>;
const mockWipeLastPrompt = provider.wipeLastPrompt as jest.MockedFunction<
  typeof provider.wipeLastPrompt
>;
const mockGetItem = InputDialog.getItem as jest.MockedFunction<
  typeof InputDialog.getItem
>;

describe('StatusBarWidget', () => {
  let widget: StatusBarWidget;
  const mockModels: IModelInfo[] = [
    {
      _id: 'model-1',
      name: 'Test Model 1',
      display_name: 'Test Model 1'
    } as any,
    {
      _id: 'model-2',
      name: 'Test Model 2',
      display_name: 'Test Model 2'
    } as any
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh widget for each test
    widget = new StatusBarWidget();
  });

  describe('constructor', () => {
    it('should create a status bar widget', () => {
      expect(widget).toBeInstanceOf(StatusBarWidget);
      expect(StatusBarWidget.widget).toBe(widget);
    });

    it('should create DOM elements', () => {
      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      );
      expect(statusBar).toBeTruthy();
    });
  });

  describe('refreshStatusBar', () => {
    it('should display current model name when model is selected', () => {
      mockGetCurrentModel.mockReturnValue(mockModels[0]);

      widget.refreshStatusBar();

      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain('Test Model 1');
      expect(widget.hasClass('jp-qiskit-code-assistant-statusbar-warn')).toBe(
        false
      );
    });

    it('should display warning when no model is selected', () => {
      mockGetCurrentModel.mockReturnValue(undefined);

      widget.refreshStatusBar();

      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain('No Model Selected');
      expect(widget.hasClass('jp-qiskit-code-assistant-statusbar-warn')).toBe(
        true
      );
    });
  });

  describe('setLoadingStatus', () => {
    it('should add loading icon to status bar', () => {
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      widget.refreshStatusBar();

      const originalContent = (
        widget.node.querySelector(
          '.jp-qiskit-code-assistant-statusbar'
        ) as HTMLElement
      ).innerHTML;

      widget.setLoadingStatus();

      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain(originalContent);
      expect(statusBar.innerHTML).toContain('<svg>refresh</svg>');
    });
  });

  describe('stopLoadingStatus', () => {
    it('should remove loading icon and refresh status bar', () => {
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      widget.setLoadingStatus();

      widget.stopLoadingStatus();

      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).not.toContain('<svg>refresh</svg>');
      expect(statusBar.innerHTML).toContain('Test Model 1');
    });

    it('should handle multiple concurrent requests correctly', () => {
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      widget.refreshStatusBar();

      // Start 3 requests
      widget.setLoadingStatus();
      widget.setLoadingStatus();
      widget.setLoadingStatus();

      let statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;

      // Should only have one spinner
      const spinnerCount = (statusBar.innerHTML.match(/<svg>/g) || []).length;
      expect(spinnerCount).toBe(1);

      // Stop first request - spinner should still be there
      widget.stopLoadingStatus();
      statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain('<svg>refresh</svg>');

      // Stop second request - spinner should still be there
      widget.stopLoadingStatus();
      statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain('<svg>refresh</svg>');

      // Stop third request - spinner should be removed
      widget.stopLoadingStatus();
      statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).not.toContain('<svg>refresh</svg>');
    });

    it('should not go negative on request count', () => {
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      widget.refreshStatusBar();

      // Call stopLoadingStatus without any active requests
      widget.stopLoadingStatus();
      widget.stopLoadingStatus();

      // Should not cause any issues
      widget.setLoadingStatus();
      const statusBar = widget.node.querySelector(
        '.jp-qiskit-code-assistant-statusbar'
      ) as HTMLElement;
      expect(statusBar.innerHTML).toContain('<svg>refresh</svg>');

      widget.stopLoadingStatus();
    });
  });

  describe('onClick', () => {
    it('should check API token and show model selection dialog', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetModelsList.mockReturnValue(mockModels);
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      mockGetItem.mockResolvedValue({
        button: { accept: false, label: 'Cancel' } as any,
        value: null
      });

      await widget.onClick();

      expect(mockCheckAPIToken).toHaveBeenCalled();
      expect(mockGetItem).toHaveBeenCalledWith({
        title: 'Select a Model',
        items: ['Test Model 1', 'Test Model 2'],
        current: 0
      });
    });

    it('should set model when user selects and accepts disclaimer', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetModelsList.mockReturnValue(mockModels);
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'Test Model 2'
      });
      mockShowDisclaimer.mockResolvedValue(true);

      await widget.onClick();

      expect(mockShowDisclaimer).toHaveBeenCalledWith('model-2');
      expect(mockWipeLastPrompt).toHaveBeenCalled();
      expect(mockSetCurrentModel).toHaveBeenCalledWith(mockModels[1]);
    });

    it('should not set model when user rejects disclaimer', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetModelsList.mockReturnValue(mockModels);
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      mockGetItem.mockResolvedValue({
        button: { accept: true, label: 'OK' } as any,
        value: 'Test Model 2'
      });
      mockShowDisclaimer.mockResolvedValue(false);

      await widget.onClick();

      expect(mockShowDisclaimer).toHaveBeenCalledWith('model-2');
      expect(mockWipeLastPrompt).not.toHaveBeenCalled();
      expect(mockSetCurrentModel).not.toHaveBeenCalled();
    });

    it('should not set model when user cancels selection', async () => {
      mockCheckAPIToken.mockResolvedValue(undefined);
      mockGetModelsList.mockReturnValue(mockModels);
      mockGetCurrentModel.mockReturnValue(mockModels[0]);
      mockGetItem.mockResolvedValue({
        button: { accept: false, label: 'Cancel' } as any,
        value: null
      });

      await widget.onClick();

      expect(mockShowDisclaimer).not.toHaveBeenCalled();
      expect(mockSetCurrentModel).not.toHaveBeenCalled();
    });
  });

  describe('DOM event handlers', () => {
    it('should attach click listener on onAfterAttach', () => {
      const addEventListenerSpy = jest.spyOn(
        widget.node.querySelector(
          '.jp-qiskit-code-assistant-statusbar'
        ) as HTMLElement,
        'addEventListener'
      );

      // Trigger onAfterAttach by simulating widget attachment
      widget['onAfterAttach'](null as any);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should remove click listener on onBeforeDetach', () => {
      const removeEventListenerSpy = jest.spyOn(
        widget.node.querySelector(
          '.jp-qiskit-code-assistant-statusbar'
        ) as HTMLElement,
        'removeEventListener'
      );

      // Trigger onBeforeDetach
      widget['onBeforeDetach'](null as any);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
