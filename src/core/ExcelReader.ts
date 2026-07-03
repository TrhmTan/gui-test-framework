import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { PageConfig, ElementConfig, TestCase, TestCaseStep, TestDataRow } from '../types';
import { getCellText } from './utils/excelUtils';

interface TestCaseColumnIndices {
  fr: number;
  yc: number;
  hl_tc_id: number;
  ml_tc_id: number;
  ll_tc_id: number;
  tc_id: number;
  is_run: number;
  summary: number;
  type: number;
  parameterized: number;
  added_manually: number;
  precondition: number;
  step: number;
  action: number;
  target: number;
  value: number;
  expected: number;
}

function getTestCaseColumnIndices(sheet: ExcelJS.Worksheet): TestCaseColumnIndices {
  const indices: TestCaseColumnIndices = {
    fr: -1,
    yc: -1,
    hl_tc_id: -1,
    ml_tc_id: -1,
    ll_tc_id: -1,
    tc_id: -1,
    is_run: -1,
    summary: -1,
    type: -1,
    parameterized: -1,
    added_manually: -1,
    precondition: -1,
    step: -1,
    action: -1,
    target: -1,
    value: -1,
    expected: -1,
  };

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const text = cell.text.trim().toLowerCase();
    if (text === 'fr') indices.fr = colNumber;
    else if (text === 'yc') indices.yc = colNumber;
    else if (text === 'hl_tc_id') indices.hl_tc_id = colNumber;
    else if (text === 'ml_tc_id') indices.ml_tc_id = colNumber;
    else if (text === 'll_tc_id') indices.ll_tc_id = colNumber;
    else if (text === 'tc_id') indices.tc_id = colNumber;
    else if (text === 'is_run') indices.is_run = colNumber;
    else if (text === 'summary') indices.summary = colNumber;
    else if (text === 'type') indices.type = colNumber;
    else if (text === 'parameterized') indices.parameterized = colNumber;
    else if (text === 'added_manually') indices.added_manually = colNumber;
    else if (text === 'precondition') indices.precondition = colNumber;
    else if (text === 'step') indices.step = colNumber;
    else if (text === 'action') indices.action = colNumber;
    else if (text === 'target') indices.target = colNumber;
    else if (text === 'value') indices.value = colNumber;
    else if (text === 'expected') indices.expected = colNumber;
  });

  return indices;
}

// getCellText imported from ./utils/excelUtils

export class ExcelReader {
  private filePath: string;
  private globalConfigPath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.globalConfigPath = path.resolve(process.cwd(), 'config/global/preconditions.xlsx');
  }

  /**
   * Tự động lấy tên module từ tên file Excel đang chạy
   */
  private getModuleName(): string {
    const filename = path.basename(this.filePath, '.xlsx');
    let cleanName = filename.replace(/^master_test_suite_/i, '');
    cleanName = cleanName.replace(/^\d+(\.\d+)*_/i, '');
    return cleanName.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  }

  /**
   * Đọc danh sách cấu hình URL của các page
   */
  async readPages(): Promise<PageConfig[]> {
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    let sheet = workbook.getWorksheet('PAGE');
    
    if (!sheet) {
      // Fallback sang preconditions.xlsx
      if (fs.existsSync(this.globalConfigPath)) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.globalConfigPath);
        sheet = workbook.getWorksheet('PAGE');
      }
    }
    
    if (!sheet) return [];

    const pages: PageConfig[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Bỏ qua header
      const pageKey = row.getCell(1).text.trim();
      const url = row.getCell(2).text.trim();
      if (pageKey && url) {
        pages.push({ page_key: pageKey, url });
      }
    });
    return pages;
  }

  /**
   * Đọc danh sách Elements của một Module
   */
  async readElements(moduleName?: string): Promise<ElementConfig[]> {
    const resolvedModule = moduleName || this.getModuleName();
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    const sheetName = `ELEMENT_${resolvedModule.toUpperCase()}`;
    let sheet = workbook.getWorksheet(sheetName);
    
    if (!sheet) {
      // Fallback sang preconditions.xlsx
      if (fs.existsSync(this.globalConfigPath)) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.globalConfigPath);
        sheet = workbook.getWorksheet(sheetName);
      }
    }
    
    if (!sheet) {
      throw new Error(`[ExcelReader] Lỗi: Không tìm thấy sheet bắt buộc [${sheetName}] trong file Excel hiện tại hoặc preconditions.xlsx.`);
    }

    const elements: ElementConfig[] = [];
    
    let elementIdCol = 1;
    let locatorTypeCol = 2;
    let locatorValueCol = 3;
    let descriptionCol = -1;

    // Tự động quét dòng header (dòng 1) để nhận diện chỉ số cột động
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === 'element_id') elementIdCol = colNumber;
      else if (text === 'locator_type') locatorTypeCol = colNumber;
      else if (text === 'locator_value') locatorValueCol = colNumber;
      else if (text === 'description') descriptionCol = colNumber;
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header
      const elementId = row.getCell(elementIdCol).text.trim();
      const locatorType = row.getCell(locatorTypeCol).text.trim();
      const locatorValue = row.getCell(locatorValueCol).text.trim();
      const description = descriptionCol !== -1 ? row.getCell(descriptionCol).text.trim() : undefined;
      if (elementId && locatorValue) {
        elements.push({
          element_id: elementId,
          locator_type: locatorType || 'xpath',
          locator_value: locatorValue,
          description: description || undefined
        });
      }
    });
    return elements;
  }

  /**
   * Đọc danh sách Test Cases cần chạy (is_run = 'Y' | 'ON' | 'YES') của một Module
   */
  async readTestCases(moduleName?: string, onlyRunnable: boolean = true): Promise<TestCase[]> {
    const resolvedModule = moduleName || this.getModuleName();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    const sheetName = `TEST_CASE_${resolvedModule.toUpperCase()}`;
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new Error(`[ExcelReader] Lỗi: Không tìm thấy sheet bắt buộc [${sheetName}] trong file Excel.`);
    }

    const casesMap = new Map<string, TestCase>();
    let currentCase: TestCase | null = null;
    let currentIsRun = false;
    
    const colIndices = getTestCaseColumnIndices(sheet);

    // Duyệt qua tất cả các hàng
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header

      const frCell = getCellText(row, colIndices.fr);
      const ycCell = getCellText(row, colIndices.yc);
      const isRunCell = getCellText(row, colIndices.is_run).toUpperCase();
      
      // Dual Key Binding: Nếu có ll_tc_id thì dùng ll_tc_id, nếu không thì dùng tc_id
      let tcIdCell = '';
      if (colIndices.ll_tc_id !== -1) {
        tcIdCell = getCellText(row, colIndices.ll_tc_id);
      } else if (colIndices.tc_id !== -1) {
        tcIdCell = getCellText(row, colIndices.tc_id);
      }

      const summaryCell = getCellText(row, colIndices.summary);
      const typeCell = getCellText(row, colIndices.type);
      const paramCell = getCellText(row, colIndices.parameterized).toUpperCase();
      const addedManuallyCell = getCellText(row, colIndices.added_manually).toUpperCase();
      const preconditionCell = getCellText(row, colIndices.precondition).trim();

      const stepNumStr = getCellText(row, colIndices.step);
      const stepNum = parseInt(stepNumStr, 10);
      const action = getCellText(row, colIndices.action);
      const target = getCellText(row, colIndices.target);
      const value = getCellText(row, colIndices.value);
      const expected = getCellText(row, colIndices.expected);

      // Nếu bắt đầu một test case mới (dựa trên tcIdCell)
      if (tcIdCell) {
        currentIsRun = isRunCell === 'ON';
        if (!onlyRunnable || currentIsRun) {
          currentCase = {
            tc_id: tcIdCell,
            summary: summaryCell,
            type: typeCell || '', // Giữ nguyên rỗng để validate lỗi bỏ trống khi parameterized = Y
            parameterized: paramCell === 'Y' ? 'Y' : 'N',
            parameterized_raw: paramCell,
            added_manually: (colIndices.added_manually !== -1 && addedManuallyCell) ? addedManuallyCell : 'N',
            is_run_raw: isRunCell,
            fr: frCell || undefined,
            yc: ycCell || undefined,
            precondition: preconditionCell || undefined,
            steps: []
          };
          casesMap.set(tcIdCell, currentCase);
        } else {
          currentCase = null;
        }
      }

      // Nếu test case hiện tại đang được cấu hình chạy hoặc đọc tất cả
      if (currentCase && (!onlyRunnable || currentIsRun) && action) {
        const step: TestCaseStep = {
          step: isNaN(stepNum) ? currentCase.steps.length + 1 : stepNum,
          action,
          target,
          value,
          expected
        };
        currentCase.steps.push(step);
      }
    });

    return Array.from(casesMap.values());
  }

  /**
   * Đọc danh sách Test Data của một Module
   */
  async readTestData(moduleName?: string): Promise<TestDataRow[]> {
    const resolvedModule = moduleName || this.getModuleName();
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    
    let sheetName = `DATA_${resolvedModule.toUpperCase()}`;
    if (resolvedModule.toLowerCase() === 'login' || resolvedModule.toLowerCase() === 'authentication') {
      sheetName = 'DATA_LOGIN';
    }
    
    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      // Fallback sang preconditions.xlsx
      if (fs.existsSync(this.globalConfigPath)) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.globalConfigPath);
        sheet = workbook.getWorksheet('AUTHENTICATION') || workbook.getWorksheet('DATA_LOGIN');
      }
    }

    if (!sheet) {
      console.warn(`[ExcelReader] Warning: Sheet DATA_${resolvedModule.toUpperCase()} / AUTHENTICATION not found.`);
      return [];
    }

    const testData: TestDataRow[] = [];
    const headers: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      // Đọc header để map động các cột dữ liệu
      if (rowNumber === 1) {
        row.eachCell(cell => {
          headers.push(cell.text.trim());
        });
        return;
      }

      const tcId = row.getCell(1).text.trim();
      if (!tcId) return;

      const dataRow: TestDataRow = { test_case_type: tcId };
      for (let i = 2; i <= headers.length; i++) {
        const key = headers[i - 1];
        if (key) {
          dataRow[key] = row.getCell(i).text.trim();
        }
      }
      testData.push(dataRow);
    });

    return testData;
  }

  /**
   * Lấy các steps của một test case cụ thể trong bất kỳ sheet nào (phục vụ call_testcase)
   */
  async getStepsByTestCase(sheetName: string, tcId: string): Promise<TestCaseStep[]> {
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    let sheet = workbook.getWorksheet(sheetName);
    
    if (!sheet) {
      // Fallback sang preconditions.xlsx
      if (fs.existsSync(this.globalConfigPath)) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.globalConfigPath);
        sheet = workbook.getWorksheet(sheetName);
      }
    }
    
    if (!sheet) return [];

    const steps: TestCaseStep[] = [];
    let isTargetTc = false;

    const isPreconditionSheet = sheetName.toUpperCase() === 'PRECONDITION';
    
    const colIndices = getTestCaseColumnIndices(sheet);

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header
      
      // Dual Key Binding
      let tcIdCell = '';
      if (isPreconditionSheet) {
        tcIdCell = getCellText(row, colIndices.tc_id);
      } else {
        if (colIndices.ll_tc_id !== -1) {
          tcIdCell = getCellText(row, colIndices.ll_tc_id);
        } else if (colIndices.tc_id !== -1) {
          tcIdCell = getCellText(row, colIndices.tc_id);
        }
      }
      
      const stepNumStr = getCellText(row, colIndices.step);
      const stepNum = parseInt(stepNumStr, 10);
      const action = getCellText(row, colIndices.action);
      const target = getCellText(row, colIndices.target);
      const value = getCellText(row, colIndices.value);
      const expected = getCellText(row, colIndices.expected);

      if (tcIdCell) {
        isTargetTc = tcIdCell === tcId;
      }

      if (isTargetTc && action) {
        steps.push({
          step: isNaN(stepNum) ? steps.length + 1 : stepNum,
          action,
          target,
          value,
          expected
        });
      }
    });

    return steps;
  }

  /**
   * Đọc danh sách Test Cases tiền đề từ sheet PRECONDITION
   * Gộp cả từ preconditions.xlsx toàn cục và sheet PRECONDITION cục bộ của file hiện tại
   */
  async readPreconditionTestCases(): Promise<TestCase[]> {
    const casesMap = new Map<string, TestCase>();

    const loadFromSheet = (sheet: ExcelJS.Worksheet) => {
      let currentCase: TestCase | null = null;
      const colIndices = getTestCaseColumnIndices(sheet);

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Header

        const isRunCell = getCellText(row, colIndices.is_run).toUpperCase();
        const tcIdCell = getCellText(row, colIndices.tc_id);
        const summaryCell = getCellText(row, colIndices.summary);

        const stepNum = parseInt(getCellText(row, colIndices.step), 10);
        const action = getCellText(row, colIndices.action);
        const target = getCellText(row, colIndices.target);
        const value = getCellText(row, colIndices.value);
        const expected = getCellText(row, colIndices.expected);

        if (tcIdCell) {
          currentCase = {
            tc_id: tcIdCell,
            summary: summaryCell,
            type: 'pos', // Mặc định cho precondition
            parameterized: 'N', // Mặc định cho precondition
            precondition: undefined,
            steps: []
          };
          casesMap.set(tcIdCell, currentCase);
        }

        if (currentCase && action) {
          const step: TestCaseStep = {
            step: isNaN(stepNum) ? currentCase.steps.length + 1 : stepNum,
            action,
            target,
            value,
            expected
          };
          currentCase.steps.push(step);
        }
      });
    };

    // 1. Nạp từ preconditions.xlsx toàn cục trước
    if (fs.existsSync(this.globalConfigPath)) {
      try {
        const wbGlobal = new ExcelJS.Workbook();
        await wbGlobal.xlsx.readFile(this.globalConfigPath);
        const sheetGlobal = wbGlobal.getWorksheet('PRECONDITION');
        if (sheetGlobal) {
          loadFromSheet(sheetGlobal);
        }
      } catch (e: any) {
        console.warn(`[ExcelReader] Warning: Lỗi khi đọc preconditions.xlsx toàn cục:`, e.message);
      }
    }

    // 2. Nạp và gộp (hoặc override) từ file Excel cục bộ đang chạy
    try {
      const wbLocal = new ExcelJS.Workbook();
      await wbLocal.xlsx.readFile(this.filePath);
      const sheetLocal = wbLocal.getWorksheet('PRECONDITION');
      if (sheetLocal) {
        loadFromSheet(sheetLocal);
      }
    } catch (e: any) {
      console.warn(`[ExcelReader] Warning: Lỗi khi đọc sheet PRECONDITION cục bộ:`, e.message);
    }

    if (casesMap.size === 0) {
      console.warn(`[ExcelReader] Warning: Không tìm thấy kịch bản tiền đề nào trong cả file cục bộ và preconditions.xlsx.`);
    }

    return Array.from(casesMap.values());
  }
}
