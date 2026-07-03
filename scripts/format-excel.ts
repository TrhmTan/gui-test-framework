import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Định dạng toàn bộ Worksheet theo chuẩn template (Master_Test_Suite_9.1.2):
 * - Font: Calibri, size 11
 * - Hàng 1 (Header): Chiều cao 30, in đậm chữ, màu chữ trắng, nền xanh đậm (#2F5496), căn giữa
 * - Các hàng khác: Căn dọc top, căn trái, tự động xuống dòng (wrapText)
 * - Header border: Viền mỏng xanh đậm (#2F5496), bottom đen
 * - Data border: Viền mỏng xám nhạt (#D9D9D9)
 * - TEST_CASE sheet: Center-align các cột is_run, added_manually, type, parameterized, step
 * - TEST_CASE sheet: Bold dòng khai báo TC (có ll_tc_id)
 * - ELEMENT sheet: Center-align cột locator_type
 * - Freeze row 1
 * - Tự động căn chỉnh độ rộng cột tối ưu từ 12 đến 45
 * @param sheet Worksheet của ExcelJS
 */
export function formatWorksheet(sheet: ExcelJS.Worksheet): void {
  // Detect sheet type based on name
  const sheetName = sheet.name.toUpperCase();
  const isTestCaseSheet = sheetName.startsWith('TEST_CASE');
  const isElementSheet = sheetName.startsWith('ELEMENT');

  // Header styles matching template (Master_Test_Suite_9.1.2_Danh_Gia_Ban_Dau.xlsx)
  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' } // White text
  };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F5496' } // Dark Blue (matching template)
  };
  const headerAlignment: Partial<ExcelJS.Alignment> = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true
  };
  const headerBorder: Partial<ExcelJS.Borders> = {
    left: { style: 'thin', color: { argb: 'FF2F5496' } },
    right: { style: 'thin', color: { argb: 'FF2F5496' } },
    top: { style: 'thin', color: { argb: 'FF2F5496' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } } // Black bottom border
  };

  // Data styles
  const dataBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  // Columns in TEST_CASE sheet that should be center-aligned (1-indexed)
  // 6=is_run, 7=added_manually, 9=type, 10=parameterized, 12=step
  const centerAlignCols = new Set([6, 7, 9, 10, 12]);

  // 1. Định dạng tất cả các dòng
  sheet.eachRow((row, rowNumber) => {
    const isHeader = rowNumber === 1;

    // Chiều cao dòng
    if (isHeader) {
      row.height = 30;
    } else if (!row.height || row.height < 20) {
      row.height = 20;
    }

    // Check if this is a TC declaration row (has ll_tc_id in col 5)
    let isTcDeclRow = false;
    if (isTestCaseSheet && !isHeader) {
      const llTcId = row.getCell(5).value;
      isTcDeclRow = !!llTcId && String(llTcId).startsWith('LL_');
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      const colNumber = typeof cell.col === 'string' ? parseInt(cell.col, 10) : Number(cell.col);

      if (isHeader) {
        // Header formatting
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = headerAlignment;
        cell.border = headerBorder;
      } else {
        // Data formatting — preserve existing color (for PASS/FAIL coloring by ResultWriter)
        const originalFont = cell.font || {};
        const originalColor = originalFont.color;
        const originalFill = cell.fill;

        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: isTcDeclRow && (colNumber === 5 || colNumber === 8) ? true : !!originalFont.bold,
          color: originalColor ? originalColor : { argb: 'FF000000' }
        };

        // Preserve existing fill (e.g., PASS/FAIL coloring)
        if (!originalFill || (originalFill as any).pattern === 'none') {
          cell.fill = { type: 'pattern', pattern: 'none' } as ExcelJS.Fill;
        }

        // Alignment: center for specific columns in TEST_CASE, locator_type in ELEMENT
        let hAlign: 'left' | 'center' | 'right' = 'left';
        if (isTestCaseSheet && centerAlignCols.has(colNumber)) {
          hAlign = 'center';
        }
        if (isElementSheet && colNumber === 2) { // locator_type column
          hAlign = 'center';
        }
        cell.alignment = {
          vertical: 'top',
          horizontal: hAlign,
          wrapText: true
        };

        cell.border = dataBorder;
      }
    });
  });

  // 2. Auto-fit Columns (Tự động căn chỉnh độ rộng cột)
  const colWidths: Record<string, number> = {};
  
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      let textValue = '';
      try {
        textValue = cell.text || '';
      } catch (e) {
        if (cell.value) {
          if (typeof cell.value === 'object') {
            if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
              textValue = (cell.value as any).richText.map((rt: any) => rt.text || '').join('');
            } else {
              textValue = String((cell.value as any).result || (cell.value as any).text || '');
            }
          } else {
            textValue = String(cell.value);
          }
        }
      }
      // Đếm độ dài chuỗi, nếu có ký tự xuống dòng thì lấy dòng dài nhất
      const lines = textValue.split('\n');
      const maxLineLen = Math.max(...lines.map(line => line.length));
      
      const colIndex = cell.col;
      const colKey = colIndex.toString();
      if (!colWidths[colKey] || maxLineLen > colWidths[colKey]) {
        colWidths[colKey] = maxLineLen;
      }
    });
  });

  Object.keys(colWidths).forEach((colKey) => {
    const colIndex = parseInt(colKey, 10);
    const column = sheet.getColumn(colIndex);
    const calculatedWidth = colWidths[colKey];
    
    // Giới hạn chiều rộng nhỏ nhất là 12, lớn nhất là 45 để Excel trông cân đối
    column.width = Math.min(Math.max(calculatedWidth + 4, 12), 45);
  });

  // 3. Freeze row 1 (header)
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Định dạng dòng Header (Row 1), Body, viền và độ rộng cột cho một file Excel
 * @param filePath Đường dẫn tuyệt đối hoặc tương đối tới file Excel
 */
export async function formatExcelFile(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.error(`[ExcelFormatter] Lỗi: Không tìm thấy file tại ${filePath}`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const sheet of workbook.worksheets) {
    formatWorksheet(sheet);
  }

  await workbook.xlsx.writeFile(filePath);
  console.log(`[ExcelFormatter] Đã định dạng in đậm dòng đầu tiên, viền, căn lề top của tất cả các sheet tại: ${filePath}`);
}

// Cho phép chạy trực tiếp từ dòng lệnh
if (require.main === module) {
  let targetPath = path.resolve(__dirname, '../data/Master_test_suite.xlsx');
  const fileArg = process.argv.find(arg => arg.startsWith('--file='));
  if (fileArg) {
    targetPath = path.resolve(fileArg.split('=')[1]);
  }
  console.log(`[ExcelFormatter] Chạy trực tiếp, định dạng file: ${targetPath}`);
  formatExcelFile(targetPath)
    .then(() => console.log('[ExcelFormatter] Done!'))
    .catch((err) => console.error('[ExcelFormatter] Error:', err));
}
