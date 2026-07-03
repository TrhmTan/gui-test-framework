import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { getCellTextFromCell, formatNewHeaderCell } from './utils/excelUtils';

// getCellTextFromCell imported from ./utils/excelUtils
// formatNewHeaderCell imported from ./utils/excelUtils

/**
 * File-level async mutex to prevent concurrent read-modify-write race conditions.
 * When multiple Playwright test iterations write to the same Excel file,
 * this ensures sequential access: iter-1 finishes writing before iter-2 reads.
 */
const fileLocks = new Map<string, Promise<void>>();

function acquireMemoryLock(filePath: string): { release: () => void; ready: Promise<void> } {
  const normalizedPath = path.resolve(filePath);
  const existing = fileLocks.get(normalizedPath) || Promise.resolve();
  let releaseFn!: () => void;
  const newLock = new Promise<void>(resolve => { releaseFn = resolve; });
  fileLocks.set(normalizedPath, existing.then(() => newLock));
  return { release: releaseFn, ready: existing };
}

async function acquireCrossProcessLock(filePath: string, timeoutMs: number = 60000): Promise<() => void> {
  const normalizedPath = path.resolve(filePath);
  const lockDir = normalizedPath + '.lock';
  const startTime = Date.now();
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      return () => {
        try {
          fs.rmdirSync(lockDir);
        } catch (e) {}
      };
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Tự động giải phóng lock quá cũ (> 5 phút) đề phòng crash
        try {
          const stats = fs.statSync(lockDir);
          const ageMs = Date.now() - stats.mtimeMs;
          if (ageMs > 5 * 60 * 1000) {
            try {
              fs.rmdirSync(lockDir);
              console.warn(`[ResultWriter] Auto-released stale lock folder: ${lockDir}`);
            } catch (e) {}
          }
        } catch (e) {}

        if (Date.now() - startTime > timeoutMs) {
          console.warn(`[ResultWriter] Timeout waiting for lock on: ${filePath}. Proceeding anyway to avoid blocking.`);
          return () => {};
        }
        await delay(50 + Math.random() * 50);
      } else {
        throw err;
      }
    }
  }
}


function parseTextToRichText(textVal: string): any[] {
  const lines = textVal.split('\n');
  const richText: any[] = [];
  
  lines.forEach((line, index) => {
    if (index > 0) {
      richText.push({ text: '\n' });
    }
    
    const passIndex = line.indexOf('PASS');
    const failIndex = line.indexOf('FAIL');
    const skipIndex = line.indexOf('SKIP');
    
    if (passIndex !== -1) {
      const prefix = line.substring(0, passIndex);
      if (prefix) {
        richText.push({ text: prefix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
      richText.push({ text: 'PASS', font: { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF008000' } } });
      const suffix = line.substring(passIndex + 4);
      if (suffix) {
        richText.push({ text: suffix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
    } else if (failIndex !== -1) {
      const prefix = line.substring(0, failIndex);
      if (prefix) {
        richText.push({ text: prefix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
      richText.push({ text: 'FAIL', font: { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFC00000' } } });
      const suffix = line.substring(failIndex + 4);
      if (suffix) {
        richText.push({ text: suffix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
    } else if (skipIndex !== -1) {
      const prefix = line.substring(0, skipIndex);
      if (prefix) {
        richText.push({ text: prefix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
      richText.push({ text: 'SKIP', font: { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF808080' } } });
      const suffix = line.substring(skipIndex + 4);
      if (suffix) {
        richText.push({ text: suffix, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
      }
    } else {
      richText.push({ text: line, font: { name: 'Segoe UI', size: 11, color: { argb: 'FF000000' } } });
    }
  });
  
  return richText;
}

function applyCellFormat(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
  };
}

export class ResultWriter {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Update the execution result of a specific test step in Excel.
   * Supports dynamic column mapping and self-healing.
   */
  async updateStepResult(
    moduleName: string,
    tcId: string,
    stepNum: number,
    result: { 
      status: 'PASSED' | 'FAILED' | 'TBD' | 'SKIP'; 
      observed: string; 
      expected?: string;
      screenshot?: string; 
      duration?: number;
      action?: string;
      iterationInfo?: {
        index: number;
        total: number;
        type?: string;
      }
    },
    options: { silent?: boolean } = {}
  ): Promise<void> {
    const memLock = acquireMemoryLock(this.filePath);
    await memLock.ready;
    const releaseCrossProcess = await acquireCrossProcessLock(this.filePath);
    try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    const sheetName = `TEST_CASE_${moduleName.toUpperCase()}`;
    const sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
      if (!options.silent) {
        console.error(`❌ [Excel] Error: Sheet ${sheetName} not found to write result.`);
      }
      return;
    }

    // Dynamic Column Mapping & Self-healing
    const headerRow = sheet.getRow(1);
    const colIndices = {
      ll_tc_id: -1,
      tc_id: -1,
      step: -1,
      expected: -1,
      observed: -1,
      test_result: -1,
      screenshot: -1,
      duration: -1,
    };

    headerRow.eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === 'll_tc_id') colIndices.ll_tc_id = colNumber;
      else if (text === 'tc_id') colIndices.tc_id = colNumber;
      else if (text === 'step') colIndices.step = colNumber;
      else if (text === 'expected') colIndices.expected = colNumber;
      else if (text === '[o]_observed') colIndices.observed = colNumber;
      else if (text === '[o]_test_result') colIndices.test_result = colNumber;
      else if (text === '[o]_screenshot') colIndices.screenshot = colNumber;
      else if (text === '[o]_duration_(s)') colIndices.duration = colNumber;
    });

    // Self-healing: If result columns are missing, add them to the end of header row
    let lastCol = headerRow.cellCount;
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber > lastCol) {
        lastCol = colNumber;
      }
    });

    let modifiedHeader = false;
    // formatNewHeaderCell imported from ./utils/excelUtils

    if (colIndices.observed === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_observed';
      formatNewHeaderCell(cell);
      colIndices.observed = lastCol;
      modifiedHeader = true;
    }
    if (colIndices.test_result === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_test_result';
      formatNewHeaderCell(cell);
      colIndices.test_result = lastCol;
      modifiedHeader = true;
    }
    if (colIndices.screenshot === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_screenshot';
      formatNewHeaderCell(cell);
      colIndices.screenshot = lastCol;
      modifiedHeader = true;
    }
    if (colIndices.duration === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_duration_(s)';
      formatNewHeaderCell(cell);
      colIndices.duration = lastCol;
      modifiedHeader = true;
    }

    if (modifiedHeader) {
      headerRow.commit();
    }

    let foundRow = false;
    let isTargetTc = false;

    sheet.eachRow((row) => {
      // Dual Key Binding
      let tcIdCell = '';
      if (colIndices.ll_tc_id !== -1) {
        tcIdCell = getCellTextFromCell(row.getCell(colIndices.ll_tc_id));
      } else if (colIndices.tc_id !== -1) {
        tcIdCell = getCellTextFromCell(row.getCell(colIndices.tc_id));
      }

      const stepCell = colIndices.step !== -1 ? parseInt(getCellTextFromCell(row.getCell(colIndices.step)), 10) : NaN;

      if (tcIdCell) {
        isTargetTc = tcIdCell === tcId;
      }

      // Match test case ID and step number
      if (isTargetTc && stepCell === stepNum) {
        const isCheckAction = result.action ? ['check_status', 'check_value'].includes(result.action.toLowerCase()) : false;
        const isFailed = result.status === 'FAILED';
        const isSkip = result.status === 'SKIP';

        // Update Expected
        if (colIndices.expected !== -1 && result.expected !== undefined && result.expected !== null) {
          const expectedCell = row.getCell(colIndices.expected);
          let finalExpected = result.expected;
          if (result.iterationInfo) {
            const iterIndex = result.iterationInfo.index;
            const totalIter = result.iterationInfo.total || 0;
            const currentIterExpectedLine = totalIter > 1 ? `[iter-${iterIndex}] ${result.expected}` : result.expected;
            if (iterIndex === 1) {
              finalExpected = currentIterExpectedLine;
            } else {
              const existingExpected = getCellTextFromCell(expectedCell);
              finalExpected = existingExpected ? `${existingExpected}\n${currentIterExpectedLine}` : currentIterExpectedLine;
            }
          }
          expectedCell.style = {}; // Reset style to avoid shared style IDs
          expectedCell.value = { richText: parseTextToRichText(finalExpected) };
          expectedCell.alignment = { wrapText: true, vertical: 'top' };
          applyCellFormat(expectedCell);
        }

        // Analyze and process observed and status
        let processedObserved = result.observed;
        let processedStatus = result.status === 'PASSED' ? 'PASS' : (result.status === 'FAILED' ? 'FAIL' : result.status);

        if (isFailed && result.observed) {
          // Show full log detail in Observed column
          processedObserved = result.observed;
          processedStatus = 'FAIL';
        } else if (result.status === 'PASSED' && isCheckAction) {
          processedStatus = 'PASS';
          if (!processedObserved && result.expected) {
            processedObserved = result.expected;
          }
        }

        // Update Observed
        const observedCell = row.getCell(colIndices.observed);
        let finalObserved = '';

        if (isCheckAction || isFailed || isSkip) {
          const baseObservedMsg = isSkip ? '' : processedObserved;
          finalObserved = baseObservedMsg;

          if (result.iterationInfo) {
            const iterIndex = result.iterationInfo.index;
            const totalIter = result.iterationInfo.total || 0;
            const currentIterLine = isSkip
              ? ''
              : (processedObserved 
                  ? (totalIter > 1 ? `[iter-${iterIndex}] ${processedObserved}` : processedObserved)
                  : (totalIter > 1 ? `[iter-${iterIndex}]` : ''));

            if (iterIndex === 1) {
              finalObserved = currentIterLine;
            } else {
              const existingVal = getCellTextFromCell(observedCell);
              if (currentIterLine) {
                finalObserved = existingVal ? `${existingVal}\n${currentIterLine}` : currentIterLine;
              } else {
                finalObserved = existingVal;
              }
            }
          }
        } else {
          if (result.iterationInfo) {
            const iterIndex = result.iterationInfo.index;
            if (iterIndex === 1) {
              finalObserved = '';
            } else {
              finalObserved = getCellTextFromCell(observedCell);
            }
          } else {
            finalObserved = '';
          }
        }

        observedCell.style = {}; // Reset style
        if (finalObserved) {
          observedCell.value = { richText: parseTextToRichText(finalObserved) };
        } else {
          observedCell.value = '';
        }
        observedCell.alignment = { wrapText: true, vertical: 'top' };
        applyCellFormat(observedCell);

        // Update Test Result
        const statusCell = row.getCell(colIndices.test_result);
        let finalStatus = '';

        if (isCheckAction || isFailed || isSkip) {
          finalStatus = processedStatus;

          if (result.iterationInfo) {
            const iterIndex = result.iterationInfo.index;
            const totalIter = result.iterationInfo.total || 0;
            const iterStatus = processedStatus;
            const currentIterStatusLine = totalIter > 1 ? `[iter-${iterIndex}] ${iterStatus}` : iterStatus;

            if (iterIndex === 1) {
              finalStatus = currentIterStatusLine;
            } else {
              const existingStatus = getCellTextFromCell(statusCell);
              finalStatus = existingStatus ? `${existingStatus}\n${currentIterStatusLine}` : currentIterStatusLine;
            }
          }
        } else {
          if (result.iterationInfo) {
            const iterIndex = result.iterationInfo.index;
            if (iterIndex === 1) {
              finalStatus = '';
            } else {
              finalStatus = getCellTextFromCell(statusCell);
            }
          } else {
            finalStatus = '';
          }
        }

        statusCell.value = null; // Clear formulas or old values
        statusCell.style = {}; // Reset style
        if (finalStatus) {
          statusCell.value = { richText: parseTextToRichText(finalStatus) };
        } else {
          statusCell.value = '';
        }
        
        statusCell.fill = {
          type: 'pattern',
          pattern: 'none'
        };
        statusCell.alignment = { wrapText: true, vertical: 'top' };
        applyCellFormat(statusCell);

        // Update Screenshot
        const screenshotCell = row.getCell(colIndices.screenshot);
        let rawScreenshot = result.screenshot || '';
        if (rawScreenshot && path.isAbsolute(rawScreenshot)) {
          rawScreenshot = path.relative(process.cwd(), rawScreenshot);
        }
        let finalScreenshot = rawScreenshot;

        if (result.iterationInfo) {
          const iterIndex = result.iterationInfo.index;
          const totalIter = result.iterationInfo.total || 0;
          const currentIterScr = rawScreenshot 
            ? (totalIter > 1 ? `[iter-${iterIndex}] ${rawScreenshot}` : rawScreenshot)
            : '';

          if (iterIndex === 1) {
            finalScreenshot = currentIterScr;
          } else {
            const existingScr = getCellTextFromCell(screenshotCell);
            if (currentIterScr) {
              finalScreenshot = existingScr ? `${existingScr}\n${currentIterScr}` : currentIterScr;
            } else {
              finalScreenshot = existingScr;
            }
          }
        }

        screenshotCell.value = null;
        screenshotCell.style = {}; // Reset style
        if (finalScreenshot) {
          if (result.screenshot) {
            let relPath = '';
            if (path.isAbsolute(result.screenshot)) {
              relPath = path.relative(path.dirname(this.filePath), result.screenshot);
            } else {
              relPath = result.screenshot;
            }
            const hyperlinkPath = relPath.replace(/\\/g, '/');
            screenshotCell.value = {
              text: finalScreenshot,
              hyperlink: hyperlinkPath
            };
            screenshotCell.font = {
              name: 'Segoe UI',
              size: 11,
              color: { argb: 'FF0563C1' },
              underline: true
            };
          } else {
            screenshotCell.value = finalScreenshot;
            screenshotCell.font = {
              name: 'Segoe UI',
              size: 11,
              color: { argb: 'FF000000' },
              bold: false
            };
          }
        } else {
          screenshotCell.value = '';
        }
        screenshotCell.alignment = { wrapText: true, vertical: 'top' };
        applyCellFormat(screenshotCell);

        // Update Duration
        const durationCell = row.getCell(colIndices.duration);
        let finalDuration: string | number = result.duration !== undefined ? result.duration : '';

        if (result.iterationInfo) {
          const iterIndex = result.iterationInfo.index;
          const totalIter = result.iterationInfo.total || 0;
          const currentIterDur = result.duration !== undefined 
            ? (totalIter > 1 ? `[iter-${iterIndex}] ${result.duration}` : result.duration)
            : '';

          if (iterIndex === 1) {
            finalDuration = currentIterDur;
          } else {
            const existingDurText = getCellTextFromCell(durationCell);
            if (currentIterDur) {
              finalDuration = existingDurText ? `${existingDurText}\n${currentIterDur}` : currentIterDur;
            } else {
              finalDuration = existingDurText;
            }
          }
        }

        durationCell.value = finalDuration;
        durationCell.style = {}; // Reset style
        durationCell.font = {
          name: 'Segoe UI',
          size: 11,
          color: { argb: 'FF000000' },
          bold: false
        };
        durationCell.alignment = { wrapText: true, vertical: 'top' };
        applyCellFormat(durationCell);

        foundRow = true;
      }
    });

    if (foundRow) {
      await workbook.xlsx.writeFile(this.filePath);
      if (!options.silent) {
        const status = result.status;
        let statusDisplay = status === 'SKIP' ? 'SKIPPED' : status;
        let colorCode = '\x1b[0m'; // Default
        let prefixSymbol = '  ℹ️ ';
        
        if (status === 'PASSED') {
          colorCode = '\x1b[32m'; // Green
          prefixSymbol = '  ✅ ';
        } else if (status === 'FAILED') {
          colorCode = '\x1b[31m'; // Red
          prefixSymbol = '  ❌ ';
        } else if (status === 'SKIP') {
          colorCode = '\x1b[90m'; // Gray
          prefixSymbol = '  ⏭️ ';
          statusDisplay = 'SKIPPED';
        }
        
        const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
        const durStr = result.duration !== undefined ? ` (${result.duration}s)` : '';
        console.log(`${workerPrefix}${prefixSymbol} [Excel] Step ${stepNum} -> ${colorCode}${statusDisplay}\x1b[0m${durStr}`);
      }
    } else {
      if (!options.silent) {
        const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
        console.warn(`${workerPrefix}⚠️ [Excel] Row not found for ${tcId} - Step ${stepNum} in sheet ${sheetName}`);
      }
    }
    } finally {
      releaseCrossProcess();
      memLock.release();
    }
  }

  /**
   * Update execution result of an Element in sheet ELEMENT_*
   */
  async updateElementResult(
    moduleName: string,
    elementId: string,
    result: { status: 'PASS' | 'FAIL'; observed: string },
    options: { silent?: boolean } = {}
  ): Promise<void> {
    const memLock = acquireMemoryLock(this.filePath);
    await memLock.ready;
    const releaseCrossProcess = await acquireCrossProcessLock(this.filePath);
    try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    const sheetName = `ELEMENT_${moduleName.toUpperCase()}`;
    const sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
      if (!options.silent) {
        console.error(`❌ [Excel] Error: Sheet ${sheetName} not found to write element result.`);
      }
      return;
    }

    // Dynamic Column Mapping & Self-healing cho Element result
    const headerRow = sheet.getRow(1);
    let observedColIdx = -1;
    let testResultColIdx = -1;

    headerRow.eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === '[o]_observed') observedColIdx = colNumber;
      else if (text === '[o]_test_result') testResultColIdx = colNumber;
    });

    let lastCol = headerRow.cellCount;
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber > lastCol) {
        lastCol = colNumber;
      }
    });

    let modifiedHeader = false;
    // formatNewHeaderCell imported from ./utils/excelUtils

    if (observedColIdx === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_observed';
      formatNewHeaderCell(cell);
      observedColIdx = lastCol;
      modifiedHeader = true;
    }
    if (testResultColIdx === -1) {
      lastCol++;
      const cell = headerRow.getCell(lastCol);
      cell.value = '[o]_test_result';
      formatNewHeaderCell(cell);
      testResultColIdx = lastCol;
      modifiedHeader = true;
    }

    if (modifiedHeader) {
      headerRow.commit();
    }

    let foundRow = false;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header
      const idCell = getCellTextFromCell(row.getCell(1));
      if (idCell === elementId) {
        row.getCell(observedColIdx).value = result.observed;
        row.getCell(testResultColIdx).value = result.status;

        const obsCell = row.getCell(observedColIdx);
        obsCell.font = { name: 'Segoe UI', size: 11 };
        obsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        applyCellFormat(obsCell);

        const statusCell = row.getCell(testResultColIdx);
        statusCell.font = {
          name: 'Segoe UI',
          size: 11,
          bold: true,
          color: { argb: result.status === 'PASS' ? 'FF008000' : 'FFFF0000' } // Green/Red
        };
        statusCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        applyCellFormat(statusCell);

        foundRow = true;
      }
    });

    if (foundRow) {
      await workbook.xlsx.writeFile(this.filePath);
      if (!options.silent) {
        const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
        console.log(`${workerPrefix}✅ [Excel] Element updated [${elementId}] -> ${result.status}`);
      }
    } else {
      if (!options.silent) {
        const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
        console.warn(`${workerPrefix}⚠️ [Excel] Element row not found for ${elementId} in sheet ${sheetName}`);
      }
    }
    } finally {
      releaseCrossProcess();
      memLock.release();
    }
  }

  /**
   * Clear test results.
   */
  async clearTestResults(moduleFilter?: string): Promise<void> {
    const memLock = acquireMemoryLock(this.filePath);
    await memLock.ready;
    const releaseCrossProcess = await acquireCrossProcessLock(this.filePath);
    try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    let modified = false;

    const targetSheetName = moduleFilter 
      ? `TEST_CASE_${moduleFilter.toUpperCase()}`
      : null;

    for (const sheet of workbook.worksheets) {
      const shouldClear = targetSheetName 
        ? sheet.name === targetSheetName 
        : sheet.name.startsWith('TEST_CASE_');

      if (shouldClear) {
        // Find indices dynamically
        const headerRow = sheet.getRow(1);
        const colIndices = {
          step: -1,
          observed: -1,
          test_result: -1,
          screenshot: -1,
          duration: -1,
        };

        headerRow.eachCell((cell, colNumber) => {
          const text = cell.text.trim().toLowerCase();
          if (text === 'step') colIndices.step = colNumber;
          else if (text === '[o]_observed') colIndices.observed = colNumber;
          else if (text === '[o]_test_result') colIndices.test_result = colNumber;
          else if (text === '[o]_screenshot') colIndices.screenshot = colNumber;
          else if (text === '[o]_duration_(s)') colIndices.duration = colNumber;
        });

        if (colIndices.step === -1) continue;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip Header

          const stepCell = row.getCell(colIndices.step).value;
          if (stepCell !== null && stepCell !== undefined && stepCell !== '') {
            const cellObs = colIndices.observed !== -1 ? row.getCell(colIndices.observed) : null;
            const cellRes = colIndices.test_result !== -1 ? row.getCell(colIndices.test_result) : null;
            const cellScr = colIndices.screenshot !== -1 ? row.getCell(colIndices.screenshot) : null;
            const cellDur = colIndices.duration !== -1 ? row.getCell(colIndices.duration) : null;

            const hasData = (cellObs && cellObs.value !== null && cellObs.value !== '') || 
                            (cellRes && cellRes.value !== null && cellRes.value !== '') || 
                            (cellScr && cellScr.value !== null && cellScr.value !== '') || 
                            (cellDur && cellDur.value !== null && cellDur.value !== '');

            if (hasData) {
              if (cellObs) {
                cellObs.value = null;
                cellObs.style = {};
                cellObs.font = { name: 'Segoe UI', size: 11 };
                cellObs.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                applyCellFormat(cellObs);
              }

              if (cellRes) {
                cellRes.value = null;
                cellRes.style = {};
                cellRes.fill = { type: 'pattern', pattern: 'none' };
                cellRes.font = { name: 'Segoe UI', size: 11, bold: false, color: { argb: 'FF000000' } };
                cellRes.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                applyCellFormat(cellRes);
              }

              if (cellScr) {
                cellScr.value = null;
                cellScr.style = {};
                cellScr.font = { name: 'Segoe UI', size: 11 };
                cellScr.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                applyCellFormat(cellScr);
              }

              if (cellDur) {
                cellDur.value = null;
                cellDur.style = {};
                cellDur.font = { name: 'Segoe UI', size: 11 };
                cellDur.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                applyCellFormat(cellDur);
              }

              modified = true;
            }
          }
        });
      }
    }

    if (modified) {
      await workbook.xlsx.writeFile(this.filePath);
      console.log(`🧹 [Excel] Cleared old test results for ${moduleFilter ? `module: ${moduleFilter}` : 'all modules'} in: ${this.filePath}`);
    } else {
      console.log(`🧹 [Excel] No old test results found to clear for ${moduleFilter ? `module: ${moduleFilter}` : 'all modules'} in: ${this.filePath}`);
    }
    } finally {
      releaseCrossProcess();
      memLock.release();
    }
  }

  /**
   * Create a copy of the results file.
   */
  async saveCopy(targetPath: string): Promise<void> {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.copyFileSync(this.filePath, targetPath);
      console.log(`💾 [Excel] Saved historical copy at: ${targetPath}`);
    } catch (error) {
      console.error(`❌ [Excel] Failed to copy Excel file:`, error);
    }
  }
}

export default ResultWriter;
