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

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { migrateNotebookCell, migrateNotebook } from '../migration';
import * as api from '../api';
import * as token from '../token';
import { Cell } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Notification, showDialog } from '@jupyterlab/apputils';
import { StatusBarWidget } from '../../StatusBarWidget';

// Mock dependencies
jest.mock('../api');
jest.mock('../token');
jest.mock('@jupyterlab/apputils', () => ({
  Notification: {
    error: jest.fn(),
    info: jest.fn(() => 'notification-id'),
    warning: jest.fn(),
    success: jest.fn(),
    dismiss: jest.fn()
  },
  showDialog: jest.fn(),
  Dialog: {
    cancelButton: jest.fn((options: any) => ({
      ...options,
      accept: false
    })),
    okButton: jest.fn((options: any) => ({
      ...options,
      accept: true
    }))
  }
}));
jest.mock('../../StatusBarWidget');

const mockPostMigration = api.postMigration as jest.MockedFunction<
  typeof api.postMigration
>;
const mockPostMigrationStreaming =
  api.postMigrationStreaming as jest.MockedFunction<
    typeof api.postMigrationStreaming
  >;
const mockCheckAPIToken = token.checkAPIToken as jest.MockedFunction<
  typeof token.checkAPIToken
>;
const mockShowDialog = showDialog as jest.MockedFunction<typeof showDialog>;

// Helper function to create mock cells
function createMockCell(type: 'code' | 'markdown', source: string): Cell {
  return {
    model: {
      type,
      sharedModel: {
        getSource: jest.fn(() => source),
        setSource: jest.fn(),
        source: source
      }
    }
  } as any;
}

// Helper function to create mock notebook panel
function createMockNotebook(cells: Cell[]): NotebookPanel {
  return {
    content: {
      widgets: cells
    }
  } as any;
}

// Helper function to create async generator for streaming
async function* createMockGenerator(chunks: any[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('Migration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAPIToken.mockResolvedValue();
    // Mock StatusBarWidget
    (StatusBarWidget as any).widget = {
      setLoadingStatus: jest.fn(),
      stopLoadingStatus: jest.fn()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('migrateNotebookCell', () => {
    it('should return early if cell is null', async () => {
      await migrateNotebookCell(null);
      expect(mockShowDialog).not.toHaveBeenCalled();
    });

    it('should show dialog and cancel migration if user clicks No', async () => {
      const mockCell = createMockCell(
        'code',
        'from qiskit import QuantumCircuit'
      );
      mockShowDialog.mockResolvedValue({
        button: { accept: false }
      } as any);

      await migrateNotebookCell(mockCell);

      expect(mockShowDialog).toHaveBeenCalledWith({
        body: 'Do you want to migrate the current notebook cell?',
        buttons: expect.any(Array)
      });
      expect(mockPostMigration).not.toHaveBeenCalled();
    });

    it('should successfully migrate a code cell (non-streaming)', async () => {
      const originalCode = 'from qiskit import QuantumCircuit';
      const migratedCode = 'from qiskit import QuantumCircuit  # Updated';
      const mockCell = createMockCell('code', originalCode);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockResolvedValue({
        migration_id: 'test-id',
        model_id: 'model-id',
        migrated_code: migratedCode,
        created_at: '2025-01-01T00:00:00Z'
      });

      await migrateNotebookCell(mockCell, false);

      expect(mockCheckAPIToken).toHaveBeenCalled();
      expect(mockPostMigration).toHaveBeenCalledWith(originalCode);
      expect(mockCell.model.sharedModel.setSource).toHaveBeenCalledWith(
        migratedCode
      );
      expect(StatusBarWidget.widget.setLoadingStatus).toHaveBeenCalled();
      expect(StatusBarWidget.widget.stopLoadingStatus).toHaveBeenCalled();
    });

    it('should successfully migrate a code cell (streaming)', async () => {
      const originalCode = 'from qiskit import QuantumCircuit';
      const mockCell = createMockCell('code', originalCode);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      const streamChunks = [
        { migration_id: 'test-id', migrated_code: 'from qiskit ' },
        { migration_id: 'test-id', migrated_code: 'import QuantumCircuit' }
      ];

      mockPostMigrationStreaming.mockReturnValue(
        createMockGenerator(streamChunks) as any
      );

      await migrateNotebookCell(mockCell, true);

      expect(mockCheckAPIToken).toHaveBeenCalled();
      expect(mockPostMigrationStreaming).toHaveBeenCalledWith(originalCode);
      // Cell should be cleared first, then updated with streaming chunks
      expect(mockCell.model.sharedModel.source).toBe(
        'from qiskit import QuantumCircuit'
      );
    });

    it('should show warning if cell is not a code cell', async () => {
      const mockCell = createMockCell('markdown', '# Header');

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      await migrateNotebookCell(mockCell);

      expect(Notification.warning).toHaveBeenCalledWith(
        'Notebook cell is not a code cell or contains no code to migrate',
        { autoClose: false }
      );
      expect(mockPostMigration).not.toHaveBeenCalled();
    });

    it('should show warning if cell has no code', async () => {
      const mockCell = createMockCell('code', '   ');

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      await migrateNotebookCell(mockCell);

      expect(Notification.warning).toHaveBeenCalledWith(
        'Notebook cell is not a code cell or contains no code to migrate',
        { autoClose: false }
      );
      expect(mockPostMigration).not.toHaveBeenCalled();
    });

    it('should show warning if migrated code is same as original', async () => {
      const code = 'print("Hello, World!")';
      const mockCell = createMockCell('code', code);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockResolvedValue({
        migration_id: 'test-id',
        model_id: 'model-id',
        migrated_code: code,
        created_at: '2025-01-01T00:00:00Z'
      });

      await migrateNotebookCell(mockCell, false);

      expect(Notification.warning).toHaveBeenCalledWith(
        'No code was found in the cell that needed to be migrated',
        { autoClose: false }
      );
    });

    it('should handle errors gracefully', async () => {
      const mockCell = createMockCell('code', 'from qiskit import *');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockRejectedValue(new Error('API Error'));

      await migrateNotebookCell(mockCell, false);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run migration',
        expect.any(Error)
      );
      expect(StatusBarWidget.widget.stopLoadingStatus).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('migrateNotebook', () => {
    it('should cancel notebook migration if user clicks No', async () => {
      const cells = [createMockCell('code', 'print("test")')];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: false }
      } as any);

      await migrateNotebook(mockNotebook);

      expect(mockShowDialog).toHaveBeenCalledWith({
        body: 'Do you want to migrate the entire notebook?',
        buttons: expect.any(Array)
      });
      expect(mockPostMigration).not.toHaveBeenCalled();
    });

    it('should show warning if no code cells found', async () => {
      const cells = [createMockCell('markdown', '# Title')];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      await migrateNotebook(mockNotebook);

      expect(Notification.warning).toHaveBeenCalledWith(
        'No code cells found to migrate',
        { autoClose: false }
      );
    });

    it('should migrate multiple code cells (non-streaming)', async () => {
      const cell1 = createMockCell('code', 'from qiskit import QuantumCircuit');
      const cell2 = createMockCell('code', 'qc = QuantumCircuit(2, 2)');
      const cells = [cell1, cell2];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      const migratedCode =
        '### Notebook_Cell_0\nfrom qiskit import QuantumCircuit\n### Notebook_Cell_1\nqc = QuantumCircuit(2, 2)';

      mockPostMigration.mockResolvedValue({
        migration_id: 'test-id',
        model_id: 'model-id',
        migrated_code: migratedCode,
        created_at: '2025-01-01T00:00:00Z'
      });

      await migrateNotebook(mockNotebook, false);

      expect(mockCheckAPIToken).toHaveBeenCalled();
      expect(mockPostMigration).toHaveBeenCalled();
      expect(StatusBarWidget.widget.setLoadingStatus).toHaveBeenCalled();
      expect(StatusBarWidget.widget.stopLoadingStatus).toHaveBeenCalled();
    });

    it('should migrate multiple code cells (streaming)', async () => {
      const cell1 = createMockCell('code', 'from qiskit import QuantumCircuit');
      const cell2 = createMockCell('code', 'qc = QuantumCircuit(2, 2)');
      const cells = [cell1, cell2];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      const streamChunks = [
        {
          migration_id: 'test-id',
          migrated_code: '### Notebook_Cell_0\nfrom qiskit '
        },
        {
          migration_id: 'test-id',
          migrated_code: 'import QuantumCircuit\n### Notebook_Cell_1\n'
        },
        { migration_id: 'test-id', migrated_code: 'qc = QuantumCircuit(2, 2)' }
      ];

      mockPostMigrationStreaming.mockReturnValue(
        createMockGenerator(streamChunks) as any
      );

      await migrateNotebook(mockNotebook, true);

      expect(mockCheckAPIToken).toHaveBeenCalled();
      expect(mockPostMigrationStreaming).toHaveBeenCalled();
    });

    it('should skip markdown cells when migrating notebook', async () => {
      const markdownCell = createMockCell('markdown', '# Header');
      const codeCell = createMockCell('code', 'print("test")');
      const cells = [markdownCell, codeCell];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockResolvedValue({
        migration_id: 'test-id',
        model_id: 'model-id',
        migrated_code: '### Notebook_Cell_1\nprint("test")',
        created_at: '2025-01-01T00:00:00Z'
      });

      await migrateNotebook(mockNotebook, false);

      // Should only process the code cell
      expect(mockPostMigration).toHaveBeenCalledWith(
        expect.stringContaining('### Notebook_Cell_1\nprint("test")')
      );
    });

    it('should handle errors gracefully during notebook migration', async () => {
      const cells = [createMockCell('code', 'from qiskit import *')];
      const mockNotebook = createMockNotebook(cells);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockRejectedValue(new Error('API Error'));

      await migrateNotebook(mockNotebook, false);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to process migration',
        expect.any(Error)
      );
      expect(StatusBarWidget.widget.stopLoadingStatus).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should show success notification after successful migration', async () => {
      const cell1 = createMockCell('code', 'from qiskit import QuantumCircuit');
      const cells = [cell1];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      mockPostMigration.mockResolvedValue({
        migration_id: 'test-id',
        model_id: 'model-id',
        migrated_code:
          '### Notebook_Cell_0\nfrom qiskit import QuantumCircuit  # Updated',
        created_at: '2025-01-01T00:00:00Z'
      });

      await migrateNotebook(mockNotebook, false);

      expect(Notification.success).toHaveBeenCalledWith(
        'Notebook successfully migrated',
        { autoClose: 5000 }
      );
    });

    it('should dismiss progress notifications during streaming', async () => {
      const cells = [createMockCell('code', 'test')];
      const mockNotebook = createMockNotebook(cells);

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      const streamChunks = [
        {
          migrationId: 'test-id',
          migratedCode: '### Notebook_Cell_0\ntest',
          input: 'test'
        }
      ];

      mockPostMigrationStreaming.mockReturnValue(
        createMockGenerator(streamChunks) as any
      );

      await migrateNotebook(mockNotebook, true);

      expect(Notification.dismiss).toHaveBeenCalled();
    });
  });
});
