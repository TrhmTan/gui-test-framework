import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

// Cấu hình mã màu ANSI cho console output đẹp mắt
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

interface ValidationError {
  type: 'ERROR' | 'WARN';
  sheet: string;
  row?: number;
  message: string;
}

function getCellText(row: ExcelJS.Row, colIndex: number): string {
  if (colIndex <= 0) return '';
  const cell = row.getCell(colIndex);
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val) return String((val as any).result || '').trim();
    if ('text' in val) return String((val as any).text || '').trim();
    return '';
  }
  return String(cell.text || val).trim();
}

async function validateExcel(l3Path: string, l2Path?: string) {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const absoluteL3Path = path.resolve(l3Path);
  if (!fs.existsSync(absoluteL3Path)) {
    console.error(`${colors.red}❌ ERROR: Không tìm thấy file Excel L3 tại: ${absoluteL3Path}${colors.reset}`);
    process.exit(1);
  }

  // 1. Nhận diện module từ tên file L3
  const filename = path.basename(absoluteL3Path, '.xlsx');
  let moduleName = filename.replace(/^master_test_suite_/i, '');
  moduleName = moduleName.replace(/^\d+(\.\d+)*_/i, '');
  moduleName = moduleName.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

  console.log(`\n${colors.bold}${colors.blue}📋 ĐANG TIẾN HÀNH KIỂM TRA FILE EXCEL: ${path.basename(absoluteL3Path)}${colors.reset}`);
  console.log(`${colors.cyan}Module Name: ${moduleName}${colors.reset}`);

  // Đọc danh sách action hợp lệ từ config/actions.txt
  const actionsPath = path.resolve('config/actions.txt');
  const validActions = new Set<string>();
  if (fs.existsSync(actionsPath)) {
    const lines = fs.readFileSync(actionsPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.trim().match(/^([a-zA-Z0-9_]+):/);
      if (match) {
        validActions.add(match[1].toLowerCase());
      }
    });
  } else {
    // Fallback actions cơ bản nếu không tìm thấy actions.txt
    ['navigate', 'click', 'input', 'clear', 'select', 'check_status', 'upload_file', 'scroll_to', 'hover', 'press_key', 'capture', 'check_value', 'wait_for', 'assert_url'].forEach(act => validActions.add(act));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absoluteL3Path);

  const elemSheetName = `ELEMENT_${moduleName}`;
  const dataSheetName = `DATA_${moduleName}`;
  const tcSheetName = `TEST_CASE_${moduleName}`;

  const elemSheet = workbook.getWorksheet(elemSheetName);
  const dataSheet = workbook.getWorksheet(dataSheetName);
  const tcSheet = workbook.getWorksheet(tcSheetName);

  // Bước 1: Kiểm tra các sheet bắt buộc
  if (!elemSheet) errors.push({ type: 'ERROR', sheet: 'STRUCTURE', message: `Thiếu sheet bắt buộc: ${elemSheetName}` });
  if (!dataSheet) errors.push({ type: 'ERROR', sheet: 'STRUCTURE', message: `Thiếu sheet bắt buộc: ${dataSheetName}` });
  if (!tcSheet) errors.push({ type: 'ERROR', sheet: 'STRUCTURE', message: `Thiếu sheet bắt buộc: ${tcSheetName}` });

  // Danh sách ID Element hợp lệ để verify sheet TEST_CASE
  const definedElements = new Set<string>();
  definedElements.add('page'); // Target mặc định cho một số action

  // Bước 2: Validate Sheet ELEMENT
  if (elemSheet) {
    let elementIdCol = 1;
    let locatorTypeCol = 2;
    let locatorValueCol = 3;
    let descriptionCol = 4;

    const headerRow = elemSheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === 'element_id') elementIdCol = colNumber;
      else if (text === 'locator_type') locatorTypeCol = colNumber;
      else if (text === 'locator_value') locatorValueCol = colNumber;
      else if (text === 'description') descriptionCol = colNumber;
    });

    const validPrefixes = ['txt_', 'btn_', 'ddl_', 'select_', 'chk_', 'rad_', 'lbl_', 'lnk_', 'error_', 'toast', 'modal_', 'tbl_', 'tab_'];
    const validLocators = ['data-testid', 'id', 'css', 'xpath', 'label', 'placeholder', 'text', 'role'];

    elemSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Bỏ qua header
      const elementId = getCellText(row, elementIdCol);
      const locatorType = getCellText(row, locatorTypeCol);
      const locatorValue = getCellText(row, locatorValueCol);
      const description = getCellText(row, descriptionCol);

      if (!elementId && !locatorValue) return; // Dòng trống

      if (!elementId) {
        errors.push({ type: 'ERROR', sheet: elemSheetName, row: rowNumber, message: 'Cột element_id bị rỗng' });
      } else {
        // Kiểm tra prefix
        const hasValidPrefix = validPrefixes.some(pref => elementId.startsWith(pref));
        if (!hasValidPrefix) {
          errors.push({ 
            type: 'ERROR', 
            sheet: elemSheetName, 
            row: rowNumber, 
            message: `element_id "${elementId}" sai prefix. Yêu cầu một trong các prefix: ${validPrefixes.join(', ')}` 
          });
        }

        // Kiểm tra trùng lặp
        if (definedElements.has(elementId)) {
          errors.push({ type: 'ERROR', sheet: elemSheetName, row: rowNumber, message: `element_id "${elementId}" bị trùng lặp` });
        } else {
          definedElements.add(elementId);
        }
      }

      if (!locatorValue) {
        errors.push({ type: 'ERROR', sheet: elemSheetName, row: rowNumber, message: `element_id "${elementId}": locator_value bị rỗng` });
      } else if (locatorValue.match(/-\w{6,10}-/)) {
        // Cảnh báo hash CSS động
        warnings.push({ 
          type: 'WARN', 
          sheet: elemSheetName, 
          row: rowNumber, 
          message: `element_id "${elementId}": locator_value "${locatorValue}" chứa ký tự hash ngẫu nhiên dễ thay đổi` 
        });
      }

      if (!locatorType) {
        errors.push({ type: 'ERROR', sheet: elemSheetName, row: rowNumber, message: `element_id "${elementId}": locator_type bị rỗng` });
      } else if (!validLocators.includes(locatorType.toLowerCase())) {
        errors.push({ 
          type: 'ERROR', 
          sheet: elemSheetName, 
          row: rowNumber, 
          message: `element_id "${elementId}": locator_type "${locatorType}" không hợp lệ. Chỉ chấp nhận: ${validLocators.join(', ')}` 
        });
      }

      if (!description) {
        warnings.push({ type: 'WARN', sheet: elemSheetName, row: rowNumber, message: `element_id "${elementId}": Cột description bị rỗng` });
      }
    });
  }

  // Bước 3: Validate Sheet DATA
  const definedDataTypes = new Set<string>();
  if (dataSheet) {
    const headers: string[] = [];
    dataSheet.getRow(1).eachCell(cell => {
      headers.push(cell.text.trim());
    });

    if (headers[0] !== 'test_case_type') {
      errors.push({ type: 'ERROR', sheet: dataSheetName, row: 1, message: `Cột đầu tiên trong sheet DATA phải là "test_case_type" (Hiện tại là "${headers[0]}")` });
    }

    dataSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const tcType = getCellText(row, 1);
      if (!tcType) return; // Dòng trống

      definedDataTypes.add(tcType.toLowerCase());

      // Kiểm tra format test_case_type
      const typeLower = tcType.toLowerCase();
      const isValidFormat = tcType.startsWith('LL_') || typeLower.startsWith('tc_pos_') || typeLower.startsWith('tc_bva_') || typeLower.startsWith('tc_neg_') || typeLower.startsWith('tc_edge_');
      if (!isValidFormat) {
        warnings.push({ 
          type: 'WARN', 
          sheet: dataSheetName, 
          row: rowNumber, 
          message: `test_case_type "${tcType}" không theo chuẩn đặt tên L3 (Ví dụ: LL_9.1.2_xxx hoặc TC_POS_xxx)` 
        });
      }

      // Kiểm tra ô trống (mọi cột)
      for (let c = 1; c <= headers.length; c++) {
        const val = getCellText(row, c);
        if (val === '') {
          errors.push({ 
            type: 'ERROR', 
            sheet: dataSheetName, 
            row: rowNumber, 
            message: `Dòng ${rowNumber}, cột "${headers[c - 1]}" bị trống. Phải điền "n/a" hoặc "empty" nếu không dùng.` 
          });
        }
      }
    });
  }

  // Bước 4: Validate Sheet TEST_CASE
  const l3UsedMlIds = new Set<string>();
  if (tcSheet) {
    let colIndices = {
      fr: -1, yc: -1, hl_tc_id: -1, ml_tc_id: -1, ll_tc_id: -1, tc_id: -1,
      is_run: -1, summary: -1, type: -1, parameterized: -1,
      added_manually: -1, precondition: -1, step: -1, action: -1,
      target: -1, value: -1, expected: -1
    };

    tcSheet.getRow(1).eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === 'fr') colIndices.fr = colNumber;
      else if (text === 'yc') colIndices.yc = colNumber;
      else if (text === 'hl_tc_id') colIndices.hl_tc_id = colNumber;
      else if (text === 'ml_tc_id') colIndices.ml_tc_id = colNumber;
      else if (text === 'll_tc_id') colIndices.ll_tc_id = colNumber;
      else if (text === 'tc_id') colIndices.tc_id = colNumber;
      else if (text === 'is_run') colIndices.is_run = colNumber;
      else if (text === 'summary') colIndices.summary = colNumber;
      else if (text === 'type') colIndices.type = colNumber;
      else if (text === 'parameterized') colIndices.parameterized = colNumber;
      else if (text === 'added_manually') colIndices.added_manually = colNumber;
      else if (text === 'precondition') colIndices.precondition = colNumber;
      else if (text === 'step') colIndices.step = colNumber;
      else if (text === 'action') colIndices.action = colNumber;
      else if (text === 'target') colIndices.target = colNumber;
      else if (text === 'value') colIndices.value = colNumber;
      else if (text === 'expected') colIndices.expected = colNumber;
    });

    let currentTcId = '';
    let currentParam = '';
    let currentType = '';

    tcSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      let tcIdCell = '';
      if (colIndices.ll_tc_id !== -1) tcIdCell = getCellText(row, colIndices.ll_tc_id);
      else if (colIndices.tc_id !== -1) tcIdCell = getCellText(row, colIndices.tc_id);

      const mlTcId = colIndices.ml_tc_id !== -1 ? getCellText(row, colIndices.ml_tc_id) : '';
      if (mlTcId) l3UsedMlIds.add(mlTcId);

      const action = colIndices.action !== -1 ? getCellText(row, colIndices.action) : '';
      const target = colIndices.target !== -1 ? getCellText(row, colIndices.target) : '';
      const value = colIndices.value !== -1 ? getCellText(row, colIndices.value) : '';
      const expected = colIndices.expected !== -1 ? getCellText(row, colIndices.expected) : '';

      if (tcIdCell) {
        currentTcId = tcIdCell;
        currentParam = colIndices.parameterized !== -1 ? getCellText(row, colIndices.parameterized).toUpperCase() : 'N';
        currentType = colIndices.type !== -1 ? getCellText(row, colIndices.type).toLowerCase() : '';

        // Kiểm tra is_run
        const isRun = colIndices.is_run !== -1 ? getCellText(row, colIndices.is_run).toUpperCase() : '';
        if (isRun && isRun !== 'ON' && isRun !== 'OFF') {
          errors.push({ 
            type: 'ERROR', 
            sheet: tcSheetName, 
            row: rowNumber, 
            message: `Test Case [${currentTcId}]: Cột is_run mang giá trị "${isRun}" (Bắt buộc phải là "ON" hoặc "OFF")` 
          });
        }
      }

      if (!action) return; // Dòng trống hoặc dòng mô tả phụ không chứa bước test

      // Kiểm tra action hợp lệ
      if (!validActions.has(action.toLowerCase())) {
        errors.push({ 
          type: 'ERROR', 
          sheet: tcSheetName, 
          row: rowNumber, 
          message: `Test Case [${currentTcId || 'N/A'}]: action "${action}" không tồn tại trong actions.txt` 
        });
      }

      // Kiểm tra target tồn tại trong ELEMENT
      if (target && action.toLowerCase() !== 'navigate') {
        const isTargetExist = definedElements.has(target);
        if (!isTargetExist) {
          errors.push({ 
            type: 'ERROR', 
            sheet: tcSheetName, 
            row: rowNumber, 
            message: `Test Case [${currentTcId || 'N/A'}]: target "${target}" không tồn tại trong sheet ELEMENT` 
          });
        }
      }

      // Kiểm tra expected cho check_status, check_value, assert_url
      if (['check_status', 'check_value', 'assert_url'].includes(action.toLowerCase()) && !expected) {
        errors.push({ 
          type: 'ERROR', 
          sheet: tcSheetName, 
          row: rowNumber, 
          message: `Test Case [${currentTcId || 'N/A'}]: action "${action}" bắt buộc phải điền cột expected` 
        });
      }

      // Kiểm tra tham chiếu value dạng $data
      if (value && value.startsWith('$')) {
        const regex = /^\$data_([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/;
        const match = value.match(regex);
        if (!match) {
          warnings.push({ 
            type: 'WARN', 
            sheet: tcSheetName, 
            row: rowNumber, 
            message: `Test Case [${currentTcId || 'N/A'}]: Tham chiếu value "${value}" sai cú pháp. Yêu cầu: $data_ModuleName.columnName` 
          });
        } else {
          // Kiểm tra xem module name tham chiếu có khớp với module hiện tại
          const refModule = match[1].toUpperCase();
          if (refModule !== moduleName) {
            warnings.push({ 
              type: 'WARN', 
              sheet: tcSheetName, 
              row: rowNumber, 
              message: `Test Case [${currentTcId || 'N/A'}]: Tham chiếu đến module khác "${refModule}". Module hiện tại: "${moduleName}"` 
            });
          }
        }
      }

      // Kiểm tra hard sleep trong wait_for
      if (action.toLowerCase() === 'wait_for' && value && value.match(/^\d+$/)) {
        errors.push({ 
          type: 'ERROR', 
          sheet: tcSheetName, 
          row: rowNumber, 
          message: `Test Case [${currentTcId || 'N/A'}]: Sử dụng wait_for với thời gian tĩnh "${value}" ms (Cấm hard sleep, hãy dùng các trạng thái như visible|hidden|networkidle)` 
        });
      }
    });

    // Kiểm tra tính đồng nhất của parameterized và DATA sheet
    // Quét lại để kiểm tra mapping DATA
    let scannedTcId = '';
    let scannedParam = 'N';
    let scannedType = '';
    tcSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      let tcIdCell = '';
      if (colIndices.ll_tc_id !== -1) tcIdCell = getCellText(row, colIndices.ll_tc_id);
      else if (colIndices.tc_id !== -1) tcIdCell = getCellText(row, colIndices.tc_id);

      if (tcIdCell) {
        scannedTcId = tcIdCell;
        scannedParam = colIndices.parameterized !== -1 ? getCellText(row, colIndices.parameterized).toUpperCase() : 'N';
        scannedType = colIndices.type !== -1 ? getCellText(row, colIndices.type).toLowerCase() : '';

        if (scannedParam === 'Y') {
          // Check xem có dòng tương ứng trong DATA (Logic đồng bộ với tests/global-setup.ts)
          const tcId = scannedTcId.toUpperCase();
          const tcType = scannedType.toLowerCase();
          
          const hasMatchingData = Array.from(definedDataTypes).some((dataTcTypeLower) => {
            if (dataTcTypeLower.toUpperCase() === tcId) return true;
            if (dataTcTypeLower === tcType) return true;

            const match = dataTcTypeLower.match(/^([a-z]+)_tc_(\d+)$/);
            if (match) {
              const dType = match[1];
              const dNum = match[2];
              const numSuffix = `_${dNum}`;

              if (tcType === 'neg') {
                return tcId.endsWith(numSuffix) && dType === 'neg';
              }
              if (tcType === 'pos') {
                return dType === 'pos';
              }
            }
            return false;
          });

          if (!hasMatchingData) {
            errors.push({
              type: 'ERROR',
              sheet: tcSheetName,
              row: rowNumber,
              message: `Test Case [${scannedTcId}]: Chọn parameterized='Y' với type='${scannedType}' nhưng không tìm thấy dòng dữ liệu nào có test_case_type tương ứng trong sheet DATA_${moduleName}`
            });
          }
        }
      }
    });
  }

  // Bước 5: Kiểm tra độ phủ L2 (L2 Coverage Check)
  let l2TotalCount = 0;
  let l2CoveredCount = 0;
  const missingL2Ids: string[] = [];

  // Tự động suy đoán đường dẫn file L2 nếu không truyền
  let resolvedL2Path = l2Path;
  if (!resolvedL2Path) {
    const parentDir = path.dirname(absoluteL3Path);
    // Ví dụ L3: data/Tiem_Chung/L3_Low_Level/9.1_Sang_loc/...
    // L2 sẽ ở: data/Tiem_Chung/L2_Mid_Level/9.1_Sang_loc/ML_TC_9.1.2_Danh_Gia_Ban_Dau.xlsx
    const l2Filename = `ML_TC_${moduleName.charAt(0) + moduleName.slice(1).toLowerCase()}.xlsx`;
    
    // Thử tìm trong thư mục L2_Mid_Level tương ứng
    const relativeL2 = absoluteL3Path.replace('L3_Low_Level', 'L2_Mid_Level').replace('Master_Test_Suite_', 'ML_TC_');
    if (fs.existsSync(relativeL2)) {
      resolvedL2Path = relativeL2;
    }
  }

  if (resolvedL2Path && fs.existsSync(resolvedL2Path)) {
    console.log(`${colors.cyan}Đang đối chiếu độ phủ với file L2: ${path.basename(resolvedL2Path)}${colors.reset}`);
    const l2Workbook = new ExcelJS.Workbook();
    await l2Workbook.xlsx.readFile(resolvedL2Path);
    
    const l2TcSheetName = `test_case_${moduleName.toLowerCase()}`;
    const l2TcSheet = l2Workbook.getWorksheet(l2TcSheetName);
    
    if (l2TcSheet) {
      let l2MlCol = -1;
      l2TcSheet.getRow(1).eachCell((cell, colNumber) => {
        const text = cell.text.trim().toLowerCase();
        if (text === 'ml_tc_id') l2MlCol = colNumber;
      });

      if (l2MlCol !== -1) {
        const l2MlIds = new Set<string>();
        l2TcSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const mlId = getCellText(row, l2MlCol);
          if (mlId) {
            l2MlIds.add(mlId);
          }
        });

        l2TotalCount = l2MlIds.size;
        l2MlIds.forEach(id => {
          if (l3UsedMlIds.has(id)) {
            l2CoveredCount++;
          } else {
            missingL2Ids.push(id);
            errors.push({
              type: 'ERROR',
              sheet: 'L2_COVERAGE',
              message: `Thiếu kịch bản L2 "${id}" chưa được phân rã/sử dụng ở sheet TEST_CASE của L3`
            });
          }
        });
      }
    } else {
      warnings.push({
        type: 'WARN',
        sheet: 'L2_COVERAGE',
        message: `Không tìm thấy sheet "${l2TcSheetName}" trong file L2 để so khớp độ phủ.`
      });
    }
  } else {
    warnings.push({
      type: 'WARN',
      sheet: 'L2_COVERAGE',
      message: `Không tìm thấy file Excel L2 gốc để đối chiếu độ phủ (đã thử tìm ở: ${resolvedL2Path || 'N/A'})`
    });
  }

  // Bước 6: In Báo cáo kết quả
  console.log(`\n${colors.bold}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}📋 VALIDATION REPORT — ${path.basename(absoluteL3Path).toUpperCase()}${colors.reset}`);
  console.log(`${colors.bold}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Ngày kiểm tra: ${new Date().toLocaleString()}`);
  console.log(`Module:        ${moduleName}`);

  // In các lỗi ERROR
  console.log(`\n${colors.bold}SHEET ELEMENT_${moduleName}:${colors.reset}`);
  const elemErrors = errors.filter(e => e.sheet === elemSheetName);
  const elemWarns = warnings.filter(e => e.sheet === elemSheetName);
  if (elemErrors.length === 0 && elemWarns.length === 0) {
    console.log(`  ${colors.green}✅ OK: Tất cả các dòng hợp lệ${colors.reset}`);
  } else {
    elemErrors.forEach(e => console.log(`  ${colors.red}❌ ERROR (Dòng ${e.row}): ${e.message}${colors.reset}`));
    elemWarns.forEach(e => console.log(`  ${colors.yellow}⚠️ WARN (Dòng ${e.row}): ${e.message}${colors.reset}`));
  }

  console.log(`\n${colors.bold}SHEET DATA_${moduleName}:${colors.reset}`);
  const dataErrors = errors.filter(e => e.sheet === dataSheetName);
  const dataWarns = warnings.filter(e => e.sheet === dataSheetName);
  if (dataErrors.length === 0 && dataWarns.length === 0) {
    console.log(`  ${colors.green}✅ OK: Tất cả các dòng hợp lệ${colors.reset}`);
  } else {
    dataErrors.forEach(e => console.log(`  ${colors.red}❌ ERROR (Dòng ${e.row}): ${e.message}${colors.reset}`));
    dataWarns.forEach(e => console.log(`  ${colors.yellow}⚠️ WARN (Dòng ${e.row}): ${e.message}${colors.reset}`));
  }

  console.log(`\n${colors.bold}SHEET TEST_CASE_${moduleName}:${colors.reset}`);
  const tcErrors = errors.filter(e => e.sheet === tcSheetName);
  const tcWarns = warnings.filter(e => e.sheet === tcSheetName);
  if (tcErrors.length === 0 && tcWarns.length === 0) {
    console.log(`  ${colors.green}✅ OK: Tất cả các dòng hợp lệ${colors.reset}`);
  } else {
    tcErrors.forEach(e => console.log(`  ${colors.red}❌ ERROR (Dòng ${e.row}): ${e.message}${colors.reset}`));
    tcWarns.forEach(e => console.log(`  ${colors.yellow}⚠️ WARN (Dòng ${e.row}): ${e.message}${colors.reset}`));
  }

  console.log(`\n${colors.bold}ĐỘ PHỦ L2 (TRACEABILITY CHECK):${colors.reset}`);
  const l2Errors = errors.filter(e => e.sheet === 'L2_COVERAGE');
  const l2Warns = warnings.filter(e => e.sheet === 'L2_COVERAGE');
  if (l2Errors.length === 0 && l2Warns.length === 0 && l2TotalCount > 0) {
    console.log(`  ${colors.green}✅ OK: Đã phủ 100% kịch bản L2 (${l2CoveredCount}/${l2TotalCount} TCs)${colors.reset}`);
  } else {
    l2Errors.forEach(e => console.log(`  ${colors.red}❌ ERROR: ${e.message}${colors.reset}`));
    l2Warns.forEach(e => console.log(`  ${colors.yellow}⚠️ WARN: ${e.message}${colors.reset}`));
    if (l2TotalCount > 0) {
      console.log(`  ${colors.bold}Độ phủ đạt: ${((l2CoveredCount / l2TotalCount) * 100).toFixed(1)}% (${l2CoveredCount}/${l2TotalCount} TCs)${colors.reset}`);
    }
  }

  console.log(`\n${colors.bold}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}TỔNG KẾT:${colors.reset}`);
  if (errors.length > 0) {
    console.log(`  ${colors.red}${colors.bold}❌ ERROR: ${errors.length} lỗi (BẮT BUỘC sửa trước khi chạy)${colors.reset}`);
  } else {
    console.log(`  ${colors.green}${colors.bold}✅ KHÔNG CÓ LỖI ERROR NÀO${colors.reset}`);
  }
  if (warnings.length > 0) {
    console.log(`  ${colors.yellow}${colors.bold}⚠️ WARN:  ${warnings.length} cảnh báo (Nên xem xét sửa đổi)${colors.reset}`);
  }
  console.log(`${colors.bold}══════════════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (errors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Chạy trực tiếp từ dòng lệnh
const fileArg = process.argv.find(arg => arg.startsWith('--file='));
if (!fileArg) {
  console.log(`${colors.yellow}Cách sử dụng: npx ts-node scripts/validate-excel.ts --file={đường_dẫn_file_L3_Excel} [--l2={đường_dẫn_file_L2}]${colors.reset}`);
  process.exit(1);
}

const l3Path = fileArg.split('=')[1];
const l2Arg = process.argv.find(arg => arg.startsWith('--l2='));
const l2Path = l2Arg ? l2Arg.split('=')[1] : undefined;

validateExcel(l3Path, l2Path).catch(err => {
  console.error(`${colors.red}Error executing validation:`, err, colors.reset);
  process.exit(1);
});
