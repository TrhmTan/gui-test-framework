import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { formatWorksheet } from './format-excel';

async function createLevel2Suite() {
  const args = process.argv.slice(2);
  const fileArg = args.find(arg => arg.startsWith('--file='));
  
  if (!fileArg) {
    console.error('❌ Lỗi: Thiếu tham số --file. Ví dụ: npx ts-node scripts/create-level2-suite.ts --file=data/Tiem_Chung/L2_Mid_Level/ML_TC_9.1.2_Danh_Gia_Ban_Dau.xlsx');
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
  // Hỗ trợ các pattern: ML_TC_9.1.2_Danh_Gia, TC_High_Level2_9.1.2_Danh_Gia
  let cleanName = filename
    .replace(/^(ML_TC_|TC_High_Level2?_)/i, '')  // Bỏ tiền tố ML_TC_ hoặc TC_High_Level_
    .replace(/^[\d.]+_/i, '');                    // Bỏ mã FR ở đầu (9.1.2_)
  
  // Chuẩn hóa tên module thành chữ in thường snake_case
  const moduleName = cleanName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  
  // Kiểm tra độ dài tên sheet (Excel giới hạn 31 ký tự)
  const testCaseSheetName = `test_case_${moduleName}`.substring(0, 31);
  const ruleSheetName = `rule_${moduleName}`.substring(0, 31);

  // Kiểm tra nếu thư mục đích chưa tồn tại thì tạo mới
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Kiểm tra nếu file đã tồn tại thì chỉ in cảnh báo hoặc cho phép ghi đè/bỏ qua
  if (fs.existsSync(filePath)) {
    console.warn(`⚠️ Cảnh báo: File Excel đã tồn tại tại [${relativePath}]. Sẽ không ghi đè để bảo vệ dữ liệu.`);
    return;
  }

  console.log(`🎬 Khởi tạo file Excel Bậc 2 cho module [${moduleName}] tại: ${relativePath}...`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity';
  workbook.created = new Date();

  // Định nghĩa các cột cho từng sheet
  // Sheet test_case: 9 cột chuẩn (L1 → L2 mapping). ll_tc_id chỉ có ở L3.
  const pageCols = [
    { header: 'FR', key: 'fr', width: 12 },
    { header: 'YC', key: 'yc', width: 12 },
    { header: 'hl_tc_id', key: 'hl_tc_id', width: 12 },  // Reference sang L1 (HL_01)
    { header: 'ml_tc_id', key: 'ml_tc_id', width: 16 },  // ID riêng L2 (ML_001)
    { header: 'title', key: 'title', width: 35 },
    { header: 'preconditions', key: 'preconditions', width: 35 },
    { header: 'steps', key: 'steps', width: 55 },
    { header: 'test_data', key: 'test_data', width: 25 },
    { header: 'expected', key: 'expected', width: 40 }
  ];

  // Sheet rule: 7 cột chuẩn (thêm Kiểu điều khiển so với version cũ)
  const ruleCols = [
    { header: 'Trường thông tin', key: 'field_name', width: 25 },
    { header: 'Bắt buộc (y/n)', key: 'required', width: 15 },
    { header: 'Kiểu điều khiển', key: 'control_type', width: 18 },  // ADDED: textbox, dropdown, radio...
    { header: 'Kiểu dữ liệu', key: 'data_type', width: 15 },
    { header: 'Vùng Hợp Lệ', key: 'valid_range', width: 30 },
    { header: 'Vùng Không Hợp Lệ', key: 'invalid_range', width: 30 },
    { header: 'Note (TBD/TBU)', key: 'note', width: 25 }
  ];

  const sheetsToCreate = [
    { name: testCaseSheetName, columns: pageCols },
    { name: ruleSheetName, columns: ruleCols }
  ];

  console.log(`  Sheet '${testCaseSheetName}': 10 cột (FR, YC, hl_tc_id, ml_tc_id, ll_tc_id, title, preconditions, steps, test_data, expected)`);
  console.log(`  Sheet '${ruleSheetName}': 7 cột (thêm Kiểu điều khiển)`);

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
  console.log(`✅ Khởi tạo thành công file Excel Bậc 2 tại: ${relativePath}`);
}

createLevel2Suite().catch(err => {
  console.error('❌ Lỗi bất ngờ khi khởi tạo module Bậc 2:', err);
  process.exit(1);
});

