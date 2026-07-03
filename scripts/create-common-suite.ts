import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { formatWorksheet } from './format-excel';

const MODULE_NAME = 'COMMON';
const TARGET_FILE = path.resolve(process.cwd(), 'data/common/test_cases_common.xlsx');

async function createCommonTestSuite() {
  if (fs.existsSync(TARGET_FILE)) {
    console.error(`❌ File đã tồn tại: ${TARGET_FILE}`);
    process.exit(1);
  }

  const dir = path.dirname(TARGET_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Antigravity';
  wb.created = new Date();

  // ─────────────────────────────────────────────────
  // Sheet 1: TEST_CASE_COMMON
  // ─────────────────────────────────────────────────
  const tcSheet = wb.addWorksheet(`TEST_CASE_${MODULE_NAME}`);
  tcSheet.columns = [
    { header: 'FR',               key: 'fr',            width: 15 },
    { header: 'YC',               key: 'yc',            width: 15 },
    { header: 'is_run',           key: 'is_run',        width: 12 },
    { header: 'tc_id',            key: 'tc_id',         width: 28 },
    { header: 'summary',          key: 'summary',       width: 45 },
    { header: 'type',             key: 'type',          width: 10 },
    { header: 'parameterized',    key: 'parameterized', width: 15 },
    { header: 'precondition',     key: 'precondition',  width: 22 },
    { header: 'step',             key: 'step',          width: 8  },
    { header: 'action',           key: 'action',        width: 18 },
    { header: 'target',           key: 'target',        width: 28 },
    { header: 'value',            key: 'value',         width: 30 },
    { header: 'expected',         key: 'expected',      width: 30 },
    { header: '[o]_observed',     key: 'observed',      width: 30 },
    { header: '[o]_test_result',  key: 'test_result',   width: 16 },
    { header: '[o]_screenshot',   key: 'screenshot',    width: 35 },
    { header: '[o]_duration_(s)', key: 'duration',      width: 15 }
  ];

  // Thêm 1 dòng test case mẫu để người dùng dễ hình dung
  tcSheet.addRow({
    fr: '',
    yc: '',
    is_run: 'ON',
    tc_id: 'TC_COMMON_001',
    summary: '(Mẫu) Mô tả test case ở đây',
    type: 'pos',
    parameterized: 'N',
    precondition: 'pre_login_success',
    step: 1,
    action: 'navigate',
    target: 'login',
    value: '',
    expected: ''
  });
  formatWorksheet(tcSheet);

  // ─────────────────────────────────────────────────
  // Sheet 2: DATA_COMMON
  // ─────────────────────────────────────────────────
  const dataSheet = wb.addWorksheet(`DATA_${MODULE_NAME}`);
  dataSheet.columns = [
    { header: 'test_case_type', key: 'test_case_type', width: 22 },
    { header: 'column_1',       key: 'col1',           width: 25 },
    { header: 'column_2',       key: 'col2',           width: 25 }
  ];
  formatWorksheet(dataSheet);

  // ─────────────────────────────────────────────────
  // Sheet 3: ELEMENT_COMMON
  // ─────────────────────────────────────────────────
  const elemSheet = wb.addWorksheet(`ELEMENT_${MODULE_NAME}`);
  elemSheet.columns = [
    { header: 'element_id',    key: 'element_id',    width: 28 },
    { header: 'locator_type',  key: 'locator_type',  width: 15 },
    { header: 'locator_value', key: 'locator_value', width: 60 }
  ];

  // Thêm 1 dòng mẫu
  elemSheet.addRow({
    element_id: 'lbl_example',
    locator_type: 'xpath',
    locator_value: '//h1[contains(text(), "Example")]'
  });
  formatWorksheet(elemSheet);

  // ─────────────────────────────────────────────────
  // Sheet 4: PAGE
  // ─────────────────────────────────────────────────
  const pageSheet = wb.addWorksheet(`PAGE`);
  pageSheet.columns = [
    { header: 'page_key', key: 'page_key', width: 25 },
    { header: 'url',      key: 'url',      width: 60 }
  ];

  pageSheet.addRow({
    page_key: `url_common_module`,
    url: `/path/to/module/page`
  });
  formatWorksheet(pageSheet);

  await wb.xlsx.writeFile(TARGET_FILE);

  console.log(`\n✅ Đã tạo thành công file: ${path.relative(process.cwd(), TARGET_FILE)}`);
  console.log(`\n📋 Các sheets đã tạo:`);
  console.log(`   - TEST_CASE_COMMON  → kịch bản test keyword-driven`);
  console.log(`   - DATA_COMMON       → dữ liệu test (parameterized)`);
  console.log(`   - ELEMENT_COMMON    → locator phần tử UI`);
  console.log(`   - PAGE              → định nghĩa URL`);
  console.log(`\n💡 Cấu hình dùng chung (PRECONDITION, ELEMENT_LOGIN) được`);
  console.log(`   tự động fallback sang: config/global/preconditions.xlsx`);
  console.log(`\n🚀 Lệnh chạy:`);
  console.log(`   .\\run common local`);
  console.log(`   .\\run common test`);
  console.log(`   npm run test:common:local`);
}

createCommonTestSuite().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
