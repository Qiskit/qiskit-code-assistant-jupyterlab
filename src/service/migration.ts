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

import { Dialog, Notification, showDialog } from '@jupyterlab/apputils';

import { postMigration, postMigrationStreaming } from './api';
import { checkAPIToken } from './token';
import { StatusBarWidget } from '../StatusBarWidget';
import { IMigrationResponse, IMigrationReturn } from '../utils/schema';
import { Cell } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';

// Constants
const NB_CELL_MARKER_PREFIX = '### Notebook_Cell_';
const NB_CELL_MARKER_REGEX = /(?=### Notebook_Cell_\d+\n)/;
const NB_CELL_ID_REGEX = /### Notebook_Cell_\d+\n/;
const NB_CELL_INDEX_REGEX = /^### Notebook_Cell_(\d+)/;
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer to prevent memory issues

// Helper functions
/**
 * Extracts migrated code from a migration response
 * @param json Migration response object
 * @returns The migrated code or empty string if not present
 */
function getMigratedCode(json: any): string {
  if (!json) {
    throw Error('Received invalid migration response');
  } else if (json.error) {
    throw Error(json.error);
  } else if (!('migrated_code' in json)) {
    throw Error('Received invalid migration response');
  } else {
    return json.migrated_code ?? '';
  }
}

/**
 * Validates if a cell is a code cell and optionally checks if it has content
 * @param nb_cell The cell to validate
 * @param allow_empty Whether to allow empty cells
 * @returns true if the cell is valid for migration
 */
function isValidCodeCell(nb_cell: Cell, allow_empty: boolean = false): boolean {
  if (nb_cell.model.type !== 'code') {
    return false;
  }

  if (allow_empty) {
    return true;
  }

  const code = nb_cell.model.sharedModel.getSource();
  return !!code.trim();
}

/**
 * Sends a migration request for the given code
 * @param inputCode Code to migrate
 * @returns Promise resolving to migration result
 */
async function migrationPromise(inputCode: string): Promise<IMigrationReturn> {
  return postMigration(inputCode).then((response: IMigrationResponse) => {
    return {
      migratedCode: response.migrated_code,
      migrationId: response.migration_id,
      input: inputCode
    };
  });
}

/**
 * Streams migration responses for the given code
 * @param inputCode Code to migrate
 * @returns Async generator yielding migration chunks
 */
async function* migrationPromiseStreaming(
  inputCode: string
): AsyncGenerator<IMigrationReturn> {
  const responseData = postMigrationStreaming(inputCode);

  for await (const chunk of responseData) {
    const item: IMigrationReturn = {
      migratedCode: getMigratedCode(chunk),
      migrationId: chunk.migration_id,
      input: inputCode
    };

    yield item;
  }
}

/**
 * Checks if the migration operation was aborted
 * @param signal Optional AbortSignal to check
 * @throws Error if the operation was cancelled
 */
function checkAbortSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Migration cancelled');
  }
}

/**
 * Validates and extracts code from a cell
 * @param cell The cell to validate
 * @returns The cell's source code
 * @throws Error if the cell contains no code to migrate
 */
function validateAndGetCellCode(cell: Cell): string {
  const code = cell.model.sharedModel.getSource();
  if (!code || !code.trim()) {
    throw new Error('Cell contains no code to migrate');
  }
  return code;
}

/**
 * Validates a migration response
 * @param response The migration response to validate
 * @throws Error if the response is invalid
 */
function validateMigrationResponse(response: IMigrationReturn): void {
  if (!response || !response.migratedCode) {
    throw new Error('Received invalid migration response');
  }
}

/**
 * Migrates a single cell using non-streaming migration
 * @param nb_cell The notebook cell to migrate
 * @param signal Optional AbortSignal to cancel the migration
 */
async function cellMigration(
  nb_cell: Cell,
  signal?: AbortSignal
): Promise<void> {
  try {
    checkAbortSignal(signal);
    const code = validateAndGetCellCode(nb_cell);

    const migrationResponse: IMigrationReturn = await migrationPromise(code);
    validateMigrationResponse(migrationResponse);

    if (migrationResponse.migratedCode.trim() === code.trim()) {
      Notification.warning('No code was found that needed to be migrated', {
        autoClose: false
      });
    } else {
      nb_cell.model.sharedModel.setSource(migrationResponse.migratedCode);
      Notification.success('Cell successfully migrated', {
        autoClose: 5000
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in cell migration:', error);
    Notification.error(`Migration failed: ${errorMessage}`, {
      autoClose: false
    });
    throw error;
  }
}

/**
 * Migrates a single cell using streaming migration for real-time updates
 * @param nb_cell The notebook cell to migrate
 * @param signal Optional AbortSignal to cancel the migration
 */
async function cellMigrationStreaming(
  nb_cell: Cell,
  signal?: AbortSignal
): Promise<void> {
  try {
    checkAbortSignal(signal);
    const code = validateAndGetCellCode(nb_cell);

    console.log('[Migration] Planning migration...');
    let currentNotificationId = Notification.info('Planning migration...', {
      autoClose: false
    });

    const migrationResponseGenerator: AsyncGenerator<IMigrationReturn> =
      migrationPromiseStreaming(code);

    let clearedCell = false;
    let hasContent = false;
    let migratedCode = '';
    let step = 0;

    for await (const chunk of migrationResponseGenerator) {
      checkAbortSignal(signal);

      if (!chunk || chunk.migratedCode === undefined) {
        console.warn('Received invalid chunk in streaming response');
        continue;
      }

      // Show progress messages at different stages
      if (step === 0 && chunk.migratedCode) {
        console.log(
          '[Migration] Reviewing migration... (step 0->1, migratedCode length:',
          migratedCode.length,
          ')'
        );
        Notification.dismiss(currentNotificationId);
        currentNotificationId = Notification.info('Reviewing migration...', {
          autoClose: false
        });
        step = 1;
      } else if (step === 1 && migratedCode.length > 50) {
        console.log(
          '[Migration] Returning response... (step 1->2, migratedCode length:',
          migratedCode.length,
          ')'
        );
        Notification.dismiss(currentNotificationId);
        currentNotificationId = Notification.info('Returning response...', {
          autoClose: false
        });
        step = 2;
      }

      if (!clearedCell && chunk.migratedCode) {
        nb_cell.model.sharedModel.source = '';
        clearedCell = true;
      }

      if (chunk.migratedCode) {
        nb_cell.model.sharedModel.source += chunk.migratedCode;
        migratedCode += chunk.migratedCode;
        hasContent = true;
      }
    }

    // Dismiss the progress notification before showing final status
    Notification.dismiss(currentNotificationId);

    if (!hasContent) {
      Notification.warning('No migrated code was received', {
        autoClose: false
      });
    } else {
      Notification.success('Cell successfully migrated', {
        autoClose: 5000
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in streaming cell migration:', error);
    Notification.error(`Streaming migration failed: ${errorMessage}`, {
      autoClose: false
    });
    throw error;
  }
}

/**
 * Migrates multiple notebook cells using non-streaming migration
 * @param notebookCells Array of notebook cells
 * @param codeCellsText Array of code cell texts with cell markers
 * @param signal Optional AbortSignal to cancel the migration
 */
async function notebookMigration(
  notebookCells: readonly Cell[],
  codeCellsText: string[],
  signal?: AbortSignal
): Promise<void> {
  try {
    checkAbortSignal(signal);

    if (!codeCellsText || codeCellsText.length === 0) {
      throw new Error('No code cells provided for migration');
    }

    const combinedCode = codeCellsText.join('\n\n');
    const migrationResponse: IMigrationReturn =
      await migrationPromise(combinedCode);

    validateMigrationResponse(migrationResponse);

    if (migrationResponse.migratedCode.trim() === combinedCode.trim()) {
      Notification.warning('No code was found that needed to be migrated', {
        autoClose: false
      });
      return;
    }

    const migratedCodeCells =
      migrationResponse.migratedCode.split(NB_CELL_MARKER_REGEX);

    for (let i = 0; i < migratedCodeCells.length; i++) {
      // Use more specific regex to match cell marker
      const match = migratedCodeCells[i].match(NB_CELL_INDEX_REGEX);
      if (match && match[1]) {
        const cellIndex = parseInt(match[1], 10);
        if (cellIndex >= 0 && cellIndex < notebookCells.length) {
          const migratedContent = migratedCodeCells[i].replace(
            NB_CELL_ID_REGEX,
            ''
          );
          notebookCells[cellIndex].model.sharedModel.setSource(migratedContent);
        } else {
          console.warn(
            `Cell index ${cellIndex} out of bounds, skipping update`
          );
        }
      }
    }

    Notification.success('Notebook successfully migrated', {
      autoClose: 5000
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in notebook migration:', error);
    Notification.error(`Notebook migration failed: ${errorMessage}`, {
      autoClose: false
    });
    throw error;
  }
}

/**
 * Migrates multiple notebook cells using streaming migration for real-time updates
 * Provides better user experience by updating cells as migration progresses
 * @param notebookCells Array of notebook cells
 * @param codeCellsText Array of code cell texts with cell markers
 * @param signal Optional AbortSignal to cancel the migration
 */
async function notebookMigrationStreaming(
  notebookCells: readonly Cell[],
  codeCellsText: string[],
  signal?: AbortSignal
): Promise<void> {
  try {
    checkAbortSignal(signal);

    if (!codeCellsText || codeCellsText.length === 0) {
      throw new Error('No code cells provided for migration');
    }

    console.log('[Migration] Planning migration...');
    let currentNotificationId = Notification.info('Planning migration...', {
      autoClose: false
    });

    const combinedCode = codeCellsText.join('\n\n');
    const migrationResponseGenerator: AsyncGenerator<IMigrationReturn> =
      migrationPromiseStreaming(combinedCode);

    let currentCellIndex = -1;
    let buffer = '';
    const cellContentMap = new Map<number, string>();
    let hasReceivedData = false;
    let fullMigratedCode = '';
    let step = 0;

    for await (const chunk of migrationResponseGenerator) {
      checkAbortSignal(signal);

      if (!chunk || chunk.migratedCode === undefined) {
        console.warn('Received invalid chunk in streaming response');
        continue;
      }

      // Show progress messages at different stages
      if (step === 0 && chunk.migratedCode) {
        console.log(
          '[Migration] Reviewing migration... (step 0->1, fullMigratedCode length:',
          fullMigratedCode.length,
          ')'
        );
        Notification.dismiss(currentNotificationId);
        currentNotificationId = Notification.info('Reviewing migration...', {
          autoClose: false
        });
        step = 1;
      } else if (step === 1 && fullMigratedCode.length > 100) {
        console.log(
          '[Migration] Returning response... (step 1->2, fullMigratedCode length:',
          fullMigratedCode.length,
          ')'
        );
        Notification.dismiss(currentNotificationId);
        currentNotificationId = Notification.info('Returning response...', {
          autoClose: false
        });
        step = 2;
      }

      hasReceivedData = true;
      buffer += chunk.migratedCode;
      fullMigratedCode += chunk.migratedCode;

      // Protect against unbounded buffer growth
      if (buffer.length > MAX_BUFFER_SIZE) {
        const error = `Streaming buffer exceeded maximum size (${MAX_BUFFER_SIZE} bytes)`;
        console.error(error);
        Notification.error(`Migration Error: ${error}`, {
          autoClose: false
        });
        throw new Error(error);
      }

      // Process complete cells in the buffer
      let markerPos = buffer.search(NB_CELL_ID_REGEX);
      while (markerPos !== -1) {
        // Save previous cell content if exists
        if (currentCellIndex !== -1) {
          const cellContent = buffer.substring(0, markerPos);
          cellContentMap.set(
            currentCellIndex,
            (cellContentMap.get(currentCellIndex) || '') + cellContent
          );

          // Update cell immediately for better streaming UX
          if (
            currentCellIndex >= 0 &&
            currentCellIndex < notebookCells.length
          ) {
            notebookCells[currentCellIndex].model.sharedModel.setSource(
              cellContentMap.get(currentCellIndex) || ''
            );
          } else {
            console.warn(
              `Cell index ${currentCellIndex} out of bounds during streaming`
            );
          }
        }

        // Extract and parse new cell index using more specific regex
        const markerMatch = buffer
          .substring(markerPos)
          .match(NB_CELL_INDEX_REGEX);
        if (markerMatch && markerMatch[1]) {
          currentCellIndex = parseInt(markerMatch[1], 10);
          // Remove the processed part including the marker
          buffer = buffer
            .substring(markerPos)
            .replace(NB_CELL_ID_REGEX, '')
            .trimStart();
        } else {
          console.error('Failed to parse cell index from marker');
          break;
        }

        markerPos = buffer.search(NB_CELL_ID_REGEX);
      }

      // Update current cell with partial content for real-time feedback
      if (currentCellIndex !== -1 && buffer.length > 0) {
        const currentContent = cellContentMap.get(currentCellIndex) || '';
        if (currentCellIndex >= 0 && currentCellIndex < notebookCells.length) {
          notebookCells[currentCellIndex].model.sharedModel.setSource(
            currentContent + buffer
          );
        }
      }
    }

    // Finalize the last cell
    if (currentCellIndex !== -1 && buffer.trim()) {
      cellContentMap.set(
        currentCellIndex,
        (cellContentMap.get(currentCellIndex) || '') + buffer
      );
      if (currentCellIndex >= 0 && currentCellIndex < notebookCells.length) {
        notebookCells[currentCellIndex].model.sharedModel.setSource(
          cellContentMap.get(currentCellIndex) || ''
        );
      }
    }

    // Dismiss the progress notification before showing final status
    Notification.dismiss(currentNotificationId);

    if (!hasReceivedData) {
      throw new Error('No data received from streaming migration');
    }

    Notification.success('Notebook successfully migrated', {
      autoClose: 5000
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error during streaming notebook migration:', error);
    Notification.error(`Streaming notebook migration failed: ${errorMessage}`, {
      autoClose: false
    });
    throw error;
  }
}

/**
 * Migrates a single notebook cell after user confirmation
 * Shows a confirmation dialog and performs migration if accepted
 * Displays loading status during migration process
 *
 * @param nb_cell The notebook cell to migrate (null returns early)
 * @param stream Whether to use streaming migration (default: false)
 * @returns Promise that resolves when migration completes or is cancelled
 *
 * @example
 * // Migrate current cell with streaming
 * await migrateNotebookCell(activeCell, true);
 */
export async function migrateNotebookCell(
  nb_cell: Cell | null,
  stream: boolean = false
): Promise<void> {
  if (!nb_cell) {
    return;
  }

  try {
    const result = await showDialog({
      body: 'Migrate the current notebook cell?',
      buttons: [
        Dialog.cancelButton({ label: 'No' }),
        Dialog.okButton({ label: 'Yes' })
      ]
    });

    if (result.button.accept) {
      // Show loading icon in status bar
      StatusBarWidget.widget.setLoadingStatus();

      // make sure notebook cell is code cell and has content
      if (!isValidCodeCell(nb_cell)) {
        Notification.warning(
          'Notebook cell is not a code cell or contains no code to migrate',
          {
            autoClose: false
          }
        );
      } else {
        await checkAPIToken();

        if (stream) {
          await cellMigrationStreaming(nb_cell);
        } else {
          await cellMigration(nb_cell);
        }
      }
    }
  } catch (error) {
    console.error('Failed to run migration', error);
  } finally {
    // Remove loading icon in status bar
    StatusBarWidget.widget.stopLoadingStatus();
  }
}

/**
 * Migrates all code cells in a notebook after user confirmation
 * Shows a confirmation dialog and performs migration on all code cells if accepted
 * Markdown cells are automatically skipped
 * Displays loading status during migration process
 *
 * @param notebook The notebook panel containing cells to migrate
 * @param stream Whether to use streaming migration (default: false)
 * @returns Promise that resolves when migration completes or is cancelled
 *
 * @example
 * // Migrate entire notebook with streaming
 * await migrateNotebook(notebookPanel, true);
 */
export async function migrateNotebook(
  notebook: NotebookPanel,
  stream: boolean = false
): Promise<void> {
  const codeCells = [];
  const cells = notebook.content.widgets;

  const result = await showDialog({
    body: 'Migrate the entire notebook?',
    buttons: [
      Dialog.cancelButton({ label: 'No' }),
      Dialog.okButton({ label: 'Yes' })
    ]
  });

  if (result.button.accept) {
    // Show loading icon in status bar
    StatusBarWidget.widget.setLoadingStatus();

    for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
      if (isValidCodeCell(cells[cellIndex])) {
        // copy code cell text and prefix with cell marker (i.e., `### Notebook_Cell_x`)
        codeCells.push(
          `${NB_CELL_MARKER_PREFIX}${cellIndex}\n${cells[cellIndex].model.sharedModel.getSource()}`
        );
      }
    }

    try {
      if (codeCells.length === 0) {
        Notification.warning('No code cells found to migrate', {
          autoClose: false
        });
      } else {
        await checkAPIToken();

        if (stream) {
          await notebookMigrationStreaming(cells, codeCells);
        } else {
          await notebookMigration(cells, codeCells);
        }
      }
    } catch (error) {
      console.error('Failed to process migration', error);
    } finally {
      // Remove loading icon in status bar
      StatusBarWidget.widget.stopLoadingStatus();
    }
  }
}
