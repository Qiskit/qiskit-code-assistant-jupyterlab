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
import {
  getModelsList,
  getCurrentModel,
  setCurrentModel,
  refreshModelsList
} from '../modelHandler';
import * as api from '../api';
import { IModelInfo } from '../../utils/schema';

// Mock dependencies
jest.mock('../api');
jest.mock('../../StatusBarWidget', () => ({
  StatusBarWidget: {
    widget: {
      refreshStatusBar: jest.fn()
    }
  }
}));

const mockGetModels = api.getModels as jest.MockedFunction<
  typeof api.getModels
>;

describe('Model Handler Service', () => {
  const mockModels: IModelInfo[] = [
    {
      _id: 'model-1',
      name: 'Test Model 1',
      disclaimer: { accepted: true }
    } as any,
    {
      _id: 'model-2',
      name: 'Test Model 2',
      disclaimer: { accepted: false }
    } as any,
    {
      _id: 'model-3',
      name: 'Test Model 3',
      disclaimer: { accepted: true }
    } as any
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getModelsList', () => {
    it('should return an array', () => {
      const result = getModelsList();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return models list after refresh', async () => {
      mockGetModels.mockResolvedValue(mockModels);

      await refreshModelsList();
      const result = getModelsList();

      expect(result).toEqual(mockModels);
      expect(result.length).toBe(3);
    });
  });

  describe('getCurrentModel', () => {
    it('should return a model or undefined', () => {
      const result = getCurrentModel();
      // Could be undefined or a model depending on test execution order
      expect(result === undefined || typeof result === 'object').toBe(true);
    });

    it('should return first model after refresh when no current model', async () => {
      mockGetModels.mockResolvedValue(mockModels);

      await refreshModelsList();
      const result = getCurrentModel();

      expect(result).toEqual(mockModels[0]);
    });
  });

  describe('setCurrentModel', () => {
    it('should set the current model', async () => {
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      setCurrentModel(mockModels[1]);
      const result = getCurrentModel();

      expect(result).toEqual(mockModels[1]);
      expect(result?._id).toBe('model-2');
    });

    it('should handle setting undefined model', async () => {
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      setCurrentModel(mockModels[1]);
      expect(getCurrentModel()).toEqual(mockModels[1]);

      setCurrentModel(undefined);
      const result = getCurrentModel();

      expect(result).toBeUndefined();
    });

    it('should not set model if not in models list', async () => {
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      const nonExistentModel = {
        _id: 'model-999',
        name: 'Non-existent'
      } as any;

      setCurrentModel(nonExistentModel);
      const result = getCurrentModel();

      expect(result).toBeUndefined();
    });
  });

  describe('refreshModelsList', () => {
    it('should successfully fetch and store models', async () => {
      mockGetModels.mockResolvedValue(mockModels);

      await refreshModelsList();

      expect(mockGetModels).toHaveBeenCalled();
      expect(getModelsList()).toEqual(mockModels);
      expect(getCurrentModel()).toEqual(mockModels[0]);
    });

    it('should preserve current model if it exists in new list', async () => {
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      setCurrentModel(mockModels[2]);
      expect(getCurrentModel()).toEqual(mockModels[2]);

      // Refresh again
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      // Current model should still be model-3
      expect(getCurrentModel()._id).toBe('model-3');
    });

    it('should reset to first model if current model not in new list', async () => {
      mockGetModels.mockResolvedValue(mockModels);
      await refreshModelsList();

      setCurrentModel(mockModels[2]);
      expect(getCurrentModel()?._id).toBe('model-3');

      // Refresh with different models list (without model-3)
      const newModels = mockModels.slice(0, 2);
      mockGetModels.mockResolvedValue(newModels);
      await refreshModelsList();

      expect(getCurrentModel()).toEqual(newModels[0]);
      expect(getCurrentModel()?._id).toBe('model-1');
    });

    it('should handle API errors', async () => {
      mockGetModels.mockRejectedValue(new Error('API Error'));

      await expect(refreshModelsList()).rejects.toThrow('API Error');
    });

    it('should handle empty models list', async () => {
      mockGetModels.mockResolvedValue([]);

      await refreshModelsList();

      expect(getModelsList()).toEqual([]);
      expect(getCurrentModel()).toBeUndefined();
    });
  });
});
