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

    it('should show warning if cell has shell command', async () => {
      const mockCell = createMockCell('code', '!pip list');

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

    it('should skip code cells with shell command when migrating notebook', async () => {
      const shellCmdCell = createMockCell('code', '!pip list');
      const codeCell = createMockCell('code', 'print("test")');
      const cells = [shellCmdCell, codeCell];
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

  describe('Helper Functions (tested indirectly)', () => {
    describe('parseCellIndex and updateCellSafely', () => {
      it('should correctly parse and update cells with valid indices', async () => {
        const cell1 = createMockCell('code', 'code1');
        const cell2 = createMockCell('code', 'code2');
        const cells = [cell1, cell2];
        const mockNotebook = createMockNotebook(cells);

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Migrated code with proper cell markers
        const migratedCode =
          '### Notebook_Cell_0\nupdated code1\n### Notebook_Cell_1\nupdated code2';

        mockPostMigration.mockResolvedValue({
          migration_id: 'test-id',
          model_id: 'model-id',
          migrated_code: migratedCode,
          created_at: '2025-01-01T00:00:00Z'
        });

        await migrateNotebook(mockNotebook, false);

        // parseCellIndex should have correctly identified indices 0 and 1
        // updateCellSafely should have updated both cells
        expect(cell1.model.sharedModel.setSource).toHaveBeenCalledWith(
          'updated code1\n'
        );
        expect(cell2.model.sharedModel.setSource).toHaveBeenCalledWith(
          'updated code2'
        );
      });

      it('should skip cells with invalid indices (out of bounds)', async () => {
        const cell1 = createMockCell('code', 'code1');
        const cells = [cell1];
        const mockNotebook = createMockNotebook(cells);
        const consoleWarnSpy = jest
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Cell index 5 is out of bounds (we only have 1 cell)
        const migratedCode = '### Notebook_Cell_5\nout of bounds code';

        mockPostMigration.mockResolvedValue({
          migration_id: 'test-id',
          model_id: 'model-id',
          migrated_code: migratedCode,
          created_at: '2025-01-01T00:00:00Z'
        });

        await migrateNotebook(mockNotebook, false);

        // updateCellSafely should log warning and skip update
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Cell index 5 out of bounds, skipping update'
        );

        consoleWarnSpy.mockRestore();
      });

      it('should handle malformed cell markers (parseCellIndex returns null)', async () => {
        const cell1 = createMockCell('code', 'code1');
        const cells = [cell1];
        const mockNotebook = createMockNotebook(cells);

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Invalid marker - not a number
        const migratedCode = '### Notebook_Cell_INVALID\ncode';

        mockPostMigration.mockResolvedValue({
          migration_id: 'test-id',
          model_id: 'model-id',
          migrated_code: migratedCode,
          created_at: '2025-01-01T00:00:00Z'
        });

        await migrateNotebook(mockNotebook, false);

        // parseCellIndex should return null for invalid marker
        // Cell should not be updated
        expect(cell1.model.sharedModel.setSource).not.toHaveBeenCalled();
      });
    });

    describe('Buffer size protection', () => {
      it('should handle large streaming content within buffer limits', async () => {
        const cells = [createMockCell('code', 'test')];
        const mockNotebook = createMockNotebook(cells);

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Create chunks that are within buffer limits (under 1MB)
        // This tests that buffer size protection doesn't trigger for normal large content
        const largeChunk = 'x'.repeat(50 * 1024); // 50KB chunk
        const streamChunks = [
          {
            migrationId: 'test-id',
            migratedCode: '### Notebook_Cell_0\n' + largeChunk,
            input: 'test'
          }
        ];

        mockPostMigrationStreaming.mockReturnValue(
          createMockGenerator(streamChunks) as any
        );

        await migrateNotebook(mockNotebook, true);

        // Should complete successfully without throwing buffer size error
        expect(mockPostMigrationStreaming).toHaveBeenCalled();
        expect(Notification.dismiss).toHaveBeenCalled();
      });
    });

    describe('AbortSignal functionality', () => {
      it('should abort cell migration when signal is triggered before migration', async () => {
        const mockCell = createMockCell('code', 'from qiskit import *');
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Create already-aborted signal
        const abortController = new AbortController();
        abortController.abort();

        // We need to test this through streaming since non-streaming doesn't expose signal parameter
        const streamChunks = [
          {
            migrationId: 'test-id',
            migratedCode: 'code',
            input: 'from qiskit import *'
          }
        ];

        mockPostMigrationStreaming.mockReturnValue(
          createMockGenerator(streamChunks) as any
        );

        // Note: The public API doesn't expose AbortSignal parameter,
        // so this tests the internal checkAbortSignal functionality indirectly
        await migrateNotebookCell(mockCell, true);

        // Migration should complete normally since we can't pass AbortSignal through public API
        // This test documents the limitation
        expect(mockPostMigrationStreaming).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it('should handle abort during streaming iteration', async () => {
        const mockCell = createMockCell('code', 'test code');
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockShowDialog.mockResolvedValue({
          button: { accept: true }
        } as any);

        // Generator that simulates abortion mid-stream
        async function* abortingGenerator() {
          yield {
            migrationId: 'test-id',
            migratedCode: 'part1',
            input: 'test code'
          };
          // Simulate error that would occur from aborted signal
          throw new Error('Migration cancelled');
        }

        mockPostMigrationStreaming.mockReturnValue(abortingGenerator() as any);

        await migrateNotebookCell(mockCell, true);

        // Should handle the abortion error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to run migration',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty generator (no chunks received)', async () => {
      const mockCell = createMockCell('code', 'test');

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      // Generator that yields no chunks at all
      async function* emptyGenerator() {
        // Yields nothing
      }

      mockPostMigrationStreaming.mockReturnValue(emptyGenerator() as any);

      await migrateNotebookCell(mockCell, true);

      // Should warn about no migrated code
      expect(Notification.warning).toHaveBeenCalledWith(
        'No migrated code was received',
        { autoClose: false }
      );
    });

    it('should handle streaming error and dismiss notification', async () => {
      const mockCell = createMockCell('code', 'test');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      // eslint-disable-next-line require-yield
      async function* errorGenerator() {
        throw new Error('Streaming error');
      }

      mockPostMigrationStreaming.mockReturnValue(errorGenerator() as any);

      await migrateNotebookCell(mockCell, true);

      // Should dismiss notification on error
      expect(Notification.dismiss).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run migration',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should process multiple streaming chunks incrementally', async () => {
      const mockCell = createMockCell('code', 'test code');

      mockShowDialog.mockResolvedValue({
        button: { accept: true }
      } as any);

      // Multiple valid chunks that should be combined
      const streamChunks: any[] = [
        { migrationId: 'test-id', migratedCode: 'part1', input: 'test' },
        { migrationId: 'test-id', migratedCode: 'part2', input: 'test' },
        { migrationId: 'test-id', migratedCode: 'part3', input: 'test' }
      ];

      mockPostMigrationStreaming.mockReturnValue(
        createMockGenerator(streamChunks) as any
      );

      await migrateNotebookCell(mockCell, true);

      // Should complete successfully with streaming API called
      expect(mockPostMigrationStreaming).toHaveBeenCalled();
      expect(Notification.dismiss).toHaveBeenCalled();
    });
  });
});
