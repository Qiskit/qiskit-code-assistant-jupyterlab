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

export const CHAR_LIMIT = 4_000;

const NB_CELL_MARKER_PREFIX = '### Notebook_Cell_';
const NB_CELL_MARKER_REGEX = /(?=### Notebook_Cell_\d+\n)/;
const NB_CELL_ID_REGEX = /### Notebook_Cell_\d+\n/;

function getMigratedCode(json: any): string {
  return json?.migrated_code ?? '';
}

async function migrationPromise(inputCode: string): Promise<IMigrationReturn> {
  return postMigration(inputCode).then((response: IMigrationResponse) => {
    return {
      migratedCode: response.migrated_code,
      migrationId: response.migration_id,
      input: inputCode
    };
  });
}

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

function isValidCodeCell(nb_cell: Cell, allow_empty: boolean = false) {
  if (nb_cell.model.type === 'code') {
    if (allow_empty) {
      return true;
    } else {
      const code = nb_cell.model.sharedModel.getSource();
      return !!code.trim();
    }
  }
  return false;
}

async function cellMigration(nb_cell: Cell) {
  const code = nb_cell.model.sharedModel.getSource();
  const migrationResponse: IMigrationReturn = await migrationPromise(code);

  if (migrationResponse?.migratedCode.trim() === code.trim()) {
    Notification.warning('No code was found that needed to be migrated', {
      autoClose: false
    });
  } else {
    nb_cell.model.sharedModel.setSource(migrationResponse.migratedCode);
  }
}

async function cellMigrationStreaming(nb_cell: Cell) {
  const code = nb_cell.model.sharedModel.getSource();
  const migrationResponseGenerator: AsyncGenerator<IMigrationReturn> =
    migrationPromiseStreaming(code);

  let clearedCell = false;
  for await (const chunk of migrationResponseGenerator) {
    if (!clearedCell && chunk.migratedCode) {
      nb_cell.model.sharedModel.source = '';
      clearedCell = true;
    }
    nb_cell.model.sharedModel.source += chunk.migratedCode;
  }
}

async function notebookMigration(
  notebookCells: readonly Cell[],
  codeCellsText: string[]
) {
  const combinedCode = codeCellsText.join('\n\n');
  const migrationResponse: IMigrationReturn =
    await migrationPromise(combinedCode);

  if (migrationResponse?.migratedCode.trim() === combinedCode.trim()) {
    Notification.warning('No code was found that needed to be migrated', {
      autoClose: false
    });
  } else {
    const migratedCodeCells =
      migrationResponse.migratedCode.split(NB_CELL_MARKER_REGEX);

    for (let i = 0; i < migratedCodeCells.length; i++) {
      const match = migratedCodeCells[i].match(/\d+/);
      if (match) {
        const cellIndex = parseInt(match[0]);
        notebookCells[cellIndex].model.sharedModel.setSource(
          migratedCodeCells[i].replace(NB_CELL_ID_REGEX, '')
        );
      }
    }
  }
}

async function notebookMigrationStreaming(
  notebookCells: readonly Cell[],
  codeCellsText: string[]
) {
  const combinedCode = codeCellsText.join('\n\n');
  const migrationResponseGenerator: AsyncGenerator<IMigrationReturn> =
    migrationPromiseStreaming(combinedCode);

  let prevCellIndex = -1;
  let migratedCombinedCode = '';
  for await (const chunk of migrationResponseGenerator) {
    migratedCombinedCode += chunk.migratedCode;
    const found = migratedCombinedCode.search(NB_CELL_ID_REGEX);
    if (found > -1) {
      const match = migratedCombinedCode.substring(found).match(/\d+/);
      if (match) {
        const cellIndex = parseInt(match[0]);
        if (prevCellIndex > -1) {
          notebookCells[prevCellIndex].model.sharedModel.setSource(
            migratedCombinedCode.replace(NB_CELL_ID_REGEX, '')
          );
        }
        prevCellIndex = cellIndex;
        migratedCombinedCode = '';
      }
    }
  }

  if (migratedCombinedCode) {
    notebookCells[prevCellIndex].model.sharedModel.setSource(
      migratedCombinedCode.replace(NB_CELL_ID_REGEX, '')
    );
  }
}

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

export async function migrateNotebook(
  notebook: NotebookPanel,
  stream: boolean = false
) {
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
