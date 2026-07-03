import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { formatWorksheet } from './format-excel';

async function initModule() {
  const args = process.argv.slice(2);
  const fileArg = args.find(arg => arg.startsWith('--file='));
  
  if (!fileArg) {
    console.error('❌ Lỗi: Thiếu tham số --file. Ví dụ: npm run init:module -- --file=data/Tiem_Chung/9.1.2_Do_Sinh_Hieu/Do_Chi_So.xlsx');
    process.exit(1);
  }

  const relativePath = fileArg.split('=')[1];
  if (!relativePath) {
    console.error('❌ Lỗi: Đường dẫn file không hợp lệ.');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), relativePath);
  const targetDir = path.dirname(filePath);
  const filename = path.basename(filePath, '.xlsx');
  
  // Trích xuất tên module sạch từ tên file
  let cleanName = filename.replace(/^master_test_suite_/i, '');
  // Loại bỏ mã số ở đầu nếu có (ví dụ: 9.1.2_ hoặc 9.1_)
  cleanName = cleanName.replace(/^\d+(\.\d+)*_/i, '');
  
  // Chuẩn hóa tên module thành chữ in hoa
  const moduleName = cleanName.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

  // Kiểm tra nếu thư mục đích chưa tồn tại thì tạo mới
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Kiểm tra nếu file đã tồn tại
  if (fs.existsSync(filePath)) {
    console.error(`❌ Lỗi: File Excel đã tồn tại tại [${relativePath}]. Không thể ghi đè.`);
    process.exit(1);
  }

  console.log(`🎬 Khởi tạo file Excel cho module [${moduleName}] tại: ${relativePath}...`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity';
  workbook.created = new Date();

  // Định nghĩa các cột cho từng sheet
  const elementCols = [
    { header: 'element_id', key: 'element_id', width: 25 },
    { header: 'locator_type', key: 'locator_type', width: 15 },
    { header: 'locator_value', key: 'locator_value', width: 50 },
    { header: 'description', key: 'description', width: 40 }
  ];

  const testCaseCols = [
    { header: 'FR', key: 'fr', width: 15 },
    { header: 'YC', key: 'yc', width: 15 },
    { header: 'hl_tc_id', key: 'hl_tc_id', width: 15 },
    { header: 'ml_tc_id', key: 'ml_tc_id', width: 20 },
    { header: 'll_tc_id', key: 'll_tc_id', width: 25 },
    { header: 'is_run', key: 'is_run', width: 12 },
    { header: 'added_manually', key: 'added_manually', width: 15 },
    { header: 'summary', key: 'summary', width: 35 },
    { header: 'type', key: 'type', width: 10 },
    { header: 'parameterized', key: 'parameterized', width: 15 },
    { header: 'precondition', key: 'precondition', width: 20 },
    { header: 'step', key: 'step', width: 10 },
    { header: 'action', key: 'action', width: 18 },
    { header: 'target', key: 'target', width: 25 },
    { header: 'value', key: 'value', width: 25 },
    { header: 'expected', key: 'expected', width: 25 },
    { header: '[o]_observed', key: 'observed', width: 25 },
    { header: '[o]_test_result', key: 'test_result', width: 15 },
    { header: '[o]_screenshot', key: 'screenshot', width: 30 },
    { header: '[o]_duration_(s)', key: 'duration', width: 15 },
    { header: 'note', key: 'note', width: 30 }
  ];

  const dataCols = [
    { header: 'test_case_type', key: 'test_case_type', width: 20 },
    { header: 'notes', key: 'notes', width: 30 }
  ];

  const sheetsToCreate = [
    { name: `ELEMENT_${moduleName}`, columns: elementCols },
    { name: `TEST_CASE_${moduleName}`, columns: testCaseCols },
    { name: `DATA_${moduleName}`, columns: dataCols }
  ];

  for (const sheetConfig of sheetsToCreate) {
    const sheet = workbook.addWorksheet(sheetConfig.name);
    sheet.columns = sheetConfig.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width
    }));

    // Áp dụng định dạng chung chuẩn chỉnh
    formatWorksheet(sheet);
  }

  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Khởi tạo thành công file Excel module tại: ${relativePath}`);
}

initModule().catch(err => {
  console.error('❌ Lỗi bất ngờ khi khởi tạo module:', err);
  process.exit(1);
});
