import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const excelPath = path.resolve(process.cwd(), 'data/Tiem_Chung/L3_Low_Level/9.1_Sang_loc/Master_Test_Suite_9.1.2_Danh_Gia_Ban_Dau.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  
  const sheet = workbook.getWorksheet('DATA_DANH_GIA_BAN_DAU');
  if (!sheet) {
    console.error('❌ Không tìm thấy sheet DATA_DANH_GIA_BAN_DAU');
    return;
  }
  
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNum) => {
    headers.push(cell.text);
  });
  
  const customerColIdx = headers.indexOf('patient_name') + 1;
  const searchColIdx = headers.indexOf('search_keyword') + 1;
  
  if (customerColIdx === 0 || searchColIdx === 0) {
    console.error('❌ Không tìm thấy cột patient_name hoặc search_keyword');
    return;
  }
  
  let updatedCount = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const customerVal = row.getCell(customerColIdx).text;
    if (customerVal.startsWith('$env_data.ddl_customer')) {
      // Gán search_keyword bằng giá trị patient_name kết hợp modifier :pid để chỉ gõ mã PID của bệnh nhân khi tìm kiếm
      row.getCell(searchColIdx).value = customerVal + ':pid';
      updatedCount++;
    }
  });
  
  await workbook.xlsx.writeFile(excelPath);
  console.log(`✅ Đã đồng bộ thành công ${updatedCount} dòng cột search_keyword sang định dạng dynamic.`);
}

main().catch(console.error);
