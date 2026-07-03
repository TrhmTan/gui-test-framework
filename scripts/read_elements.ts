import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('data/Tiem_Chung/L3_Low_Level/9.1_Sang_loc/Master_Test_Suite_9.1.2_Danh_Gia_Ban_Dau.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet('ELEMENT_DANH_GIA_BAN_DAU');
  if (!sheet) {
    console.error('Sheet ELEMENT_DANH_GIA_BAN_DAU not found!');
    return;
  }
  console.log('Elements:');
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const elementId = row.getCell(1).text.trim();
    const locatorType = row.getCell(2).text.trim();
    const locatorValue = row.getCell(3).text.trim();
    if (elementId === 'lbl_priority_tag') {
      console.log(`- ${elementId}: type=${locatorType}, value=${locatorValue}`);
    }
  });
}

main().catch(console.error);

