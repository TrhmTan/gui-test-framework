import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { formatWorksheet } from './format-excel';

/**
 * Tạo file Master_Test_Suite_SauceDemo.xlsx — bộ kịch bản demo thực chạy
 * trên trang public https://www.saucedemo.com (portfolio demo cho framework).
 *
 * Sheets sinh ra (đúng theo quy ước đọc của ExcelReader.ts):
 *  - PAGE                    (cột 1: page_key, cột 2: url)
 *  - PRECONDITION            (is_run, tc_id, summary, step, action, target, value, expected)
 *  - ELEMENT_SAUCEDEMO       (element_id, locator_type, locator_value, description)
 *  - TEST_CASE_SAUCEDEMO     (tc_id, is_run, summary, type, parameterized, added_manually, precondition, step, action, target, value, expected)
 *  - DATA_SAUCEDEMO          (test_case_type, username, password, ...)
 */
export async function generateSauceDemoSuite(): Promise<void> {
  const targetDir = path.resolve(__dirname, '../data/SauceDemo/L3_Low_Level');
  const targetPath = path.resolve(targetDir, 'Master_Test_Suite_SauceDemo.xlsx');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`[SauceDemoSuiteGenerator] Đang tạo mới file: ${targetPath}`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity';
  workbook.created = new Date();

  const allSheets: ExcelJS.Worksheet[] = [];

  // ── 1. PAGE ──────────────────────────────────────────────────
  const pageSheet = workbook.addWorksheet('PAGE');
  pageSheet.columns = [
    { header: 'page', key: 'page', width: 25 },
    { header: 'url', key: 'url', width: 45 }
  ];
  allSheets.push(pageSheet);

  pageSheet.addRow({ page: 'login', url: '/' });
  pageSheet.addRow({ page: 'inventory', url: '/inventory.html' });
  pageSheet.addRow({ page: 'cart', url: '/cart.html' });

  // ── 2. PRECONDITION ──────────────────────────────────────────
  // pre_super_admin_login_success là precondition mặc định mà tests/main.spec.ts
  // tự động dùng khi 1 TC không khai báo cột `precondition` riêng.
  const preconditionSheet = workbook.addWorksheet('PRECONDITION');
  preconditionSheet.columns = [
    { header: 'is_run', key: 'is_run', width: 12 },
    { header: 'tc_id', key: 'tc_id', width: 30 },
    { header: 'summary', key: 'summary', width: 30 },
    { header: 'step', key: 'step', width: 10 },
    { header: 'action', key: 'action', width: 18 },
    { header: 'target', key: 'target', width: 25 },
    { header: 'value', key: 'value', width: 25 },
    { header: 'expected', key: 'expected', width: 25 }
  ];
  allSheets.push(preconditionSheet);

  const preRows: any[] = [
    { is_run: 'ON', tc_id: 'pre_super_admin_login_success', summary: 'Login vao SauceDemo bang standard_user', step: 1, action: 'navigate', target: 'login', value: '', expected: '' },
    { is_run: '', tc_id: '', summary: '', step: 2, action: 'input', target: 'txt_username', value: 'standard_user', expected: '' },
    { is_run: '', tc_id: '', summary: '', step: 3, action: 'input', target: 'txt_password', value: 'secret_sauce', expected: '' },
    { is_run: '', tc_id: '', summary: '', step: 4, action: 'click', target: 'btn_login', value: '', expected: '' },
    { is_run: '', tc_id: '', summary: '', step: 5, action: 'assert_url', target: '', value: '', expected: '/inventory.html' }
  ];
  preRows.forEach(r => preconditionSheet.addRow(r));

  // ── 3a. ELEMENT_LOGIN ────────────────────────────────────────
  // tests/global-setup.ts đọc riêng sheet ELEMENT_LOGIN (module 'login') để
  // phân giải locator cho các bước của precondition pre_super_admin_login_success
  // khi tạo storageState lần đầu — cần khai báo trùng các locator login ở đây.
  const elementLoginSheet = workbook.addWorksheet('ELEMENT_LOGIN');
  elementLoginSheet.columns = [
    { header: 'element_id', key: 'element_id', width: 30 },
    { header: 'locator_type', key: 'locator_type', width: 15 },
    { header: 'locator_value', key: 'locator_value', width: 45 },
    { header: 'description', key: 'description', width: 45 }
  ];
  allSheets.push(elementLoginSheet);

  const elementLoginRows = [
    { element_id: 'txt_username', locator_type: 'css', locator_value: '#user-name', description: 'O nhap Username tren trang Login' },
    { element_id: 'txt_password', locator_type: 'css', locator_value: '#password', description: 'O nhap Password tren trang Login' },
    { element_id: 'btn_login', locator_type: 'css', locator_value: '#login-button', description: 'Nut Login tren trang Login' },
    { element_id: 'msg_error', locator_type: 'css', locator_value: '[data-test="error"]', description: 'Banner thong bao loi khi Login that bai' }
  ];
  elementLoginRows.forEach(r => elementLoginSheet.addRow(r));

  // ── 3. ELEMENT_SAUCEDEMO ─────────────────────────────────────
  const elementSheet = workbook.addWorksheet('ELEMENT_SAUCEDEMO');
  elementSheet.columns = [
    { header: 'element_id', key: 'element_id', width: 30 },
    { header: 'locator_type', key: 'locator_type', width: 15 },
    { header: 'locator_value', key: 'locator_value', width: 45 },
    { header: 'description', key: 'description', width: 45 }
  ];
  allSheets.push(elementSheet);

  const elementRows = [
    { element_id: 'txt_username', locator_type: 'css', locator_value: '#user-name', description: 'O nhap Username tren trang Login' },
    { element_id: 'txt_password', locator_type: 'css', locator_value: '#password', description: 'O nhap Password tren trang Login' },
    { element_id: 'btn_login', locator_type: 'css', locator_value: '#login-button', description: 'Nut Login tren trang Login' },
    { element_id: 'msg_error', locator_type: 'css', locator_value: '[data-test="error"]', description: 'Banner thong bao loi khi Login that bai' },
    { element_id: 'btn_add_to_cart_backpack', locator_type: 'css', locator_value: '[data-test="add-to-cart-sauce-labs-backpack"]', description: 'Nut Add to cart cho san pham Sauce Labs Backpack' },
    { element_id: 'badge_cart', locator_type: 'css', locator_value: '.shopping_cart_badge', description: 'So luong san pham hien thi tren icon gio hang' },
    { element_id: 'icon_cart_link', locator_type: 'css', locator_value: '.shopping_cart_link', description: 'Icon gio hang o header, dan toi trang Cart' },
    { element_id: 'cart_item', locator_type: 'css', locator_value: '.cart_item', description: 'Dong san pham hien thi trong trang Cart' },
    { element_id: 'cart_item_name', locator_type: 'css', locator_value: '.cart_item .inventory_item_name', description: 'Ten san pham hien thi trong trang Cart' }
  ];
  elementRows.forEach(r => elementSheet.addRow(r));

  // ── 4. TEST_CASE_SAUCEDEMO ───────────────────────────────────
  const testCaseSheet = workbook.addWorksheet('TEST_CASE_SAUCEDEMO');
  testCaseSheet.columns = [
    { header: 'tc_id', key: 'tc_id', width: 20 },
    { header: 'is_run', key: 'is_run', width: 10 },
    { header: 'summary', key: 'summary', width: 35 },
    { header: 'type', key: 'type', width: 8 },
    { header: 'parameterized', key: 'parameterized', width: 14 },
    { header: 'added_manually', key: 'added_manually', width: 15 },
    { header: 'precondition', key: 'precondition', width: 30 },
    { header: 'step', key: 'step', width: 8 },
    { header: 'action', key: 'action', width: 15 },
    { header: 'target', key: 'target', width: 28 },
    { header: 'value', key: 'value', width: 25 },
    { header: 'expected', key: 'expected', width: 30 }
  ];
  allSheets.push(testCaseSheet);

  const tcRows: any[] = [
    // ── TC-LOGIN-001 (positive): standard_user logs in successfully ──
    { tc_id: 'TC-LOGIN-001', is_run: 'ON', summary: 'Login thanh cong voi standard_user', type: 'pos', parameterized: 'N', added_manually: 'Y', precondition: '', step: 1, action: 'navigate', target: 'login', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 2, action: 'input', target: 'txt_username', value: 'standard_user', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 3, action: 'input', target: 'txt_password', value: 'secret_sauce', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 4, action: 'click', target: 'btn_login', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 5, action: 'assert_url', target: '', value: '', expected: '/inventory.html' },

    // ── TC-LOGIN-002 (negative): locked_out_user is blocked ──
    { tc_id: 'TC-LOGIN-002', is_run: 'ON', summary: 'Login that bai voi locked_out_user - hien thi thong bao loi', type: 'neg', parameterized: 'N', added_manually: 'Y', precondition: '', step: 1, action: 'navigate', target: 'login', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 2, action: 'input', target: 'txt_username', value: 'locked_out_user', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 3, action: 'input', target: 'txt_password', value: 'secret_sauce', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 4, action: 'click', target: 'btn_login', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 5, action: 'check_status', target: 'msg_error', value: '', expected: 'visible' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 6, action: 'check_status', target: 'msg_error', value: '', expected: 'Epic sadface: Sorry, this user has been locked out.' },

    // ── TC-CART-001: add product to cart, badge shows 1 ──
    // Không khai báo precondition riêng -> engine tự dùng pre_super_admin_login_success (đã login sẵn standard_user)
    { tc_id: 'TC-CART-001', is_run: 'ON', summary: 'Them san pham vao gio hang - badge hien thi 1', type: 'pos', parameterized: 'N', added_manually: 'Y', precondition: 'pre_super_admin_login_success', step: 1, action: 'navigate', target: 'inventory', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 2, action: 'click', target: 'btn_add_to_cart_backpack', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 3, action: 'check_status', target: 'badge_cart', value: '', expected: '1' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 4, action: 'click', target: 'icon_cart_link', value: '', expected: '' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 5, action: 'assert_url', target: '', value: '', expected: '/cart.html' },
    { tc_id: '', is_run: '', summary: '', type: '', parameterized: '', added_manually: '', precondition: '', step: 6, action: 'check_status', target: 'cart_item', value: '', expected: 'visible' }
  ];
  tcRows.forEach(r => testCaseSheet.addRow(r));

  // ── 5. DATA_SAUCEDEMO ────────────────────────────────────────
  // Không có TC nào dùng $data_ tham chiếu (parameterized = N ở tất cả) nên sheet DATA
  // chỉ đóng vai trò tài liệu tham khảo / mở rộng về sau — vẫn tạo để đúng quy ước bộ 4 sheet.
  const dataSheet = workbook.addWorksheet('DATA_SAUCEDEMO');
  dataSheet.columns = [
    { header: 'test_case_type', key: 'test_case_type', width: 20 },
    { header: 'username', key: 'username', width: 25 },
    { header: 'password', key: 'password', width: 20 },
    { header: 'note', key: 'note', width: 45 }
  ];
  allSheets.push(dataSheet);

  dataSheet.addRow({ test_case_type: 'pos', username: 'standard_user', password: 'secret_sauce', note: 'Tai khoan public chuan cua SauceDemo dung cho test positive' });
  dataSheet.addRow({ test_case_type: 'neg', username: 'locked_out_user', password: 'secret_sauce', note: 'Tai khoan public bi khoa cua SauceDemo dung cho test negative' });

  // ── 6. Format & Save ─────────────────────────────────────────
  for (const sheet of allSheets) {
    formatWorksheet(sheet);
  }

  await workbook.xlsx.writeFile(targetPath);
  console.log(`[SauceDemoSuiteGenerator] Hoan thanh! File da duoc tao tai: ${targetPath}`);
}

if (require.main === module) {
  generateSauceDemoSuite()
    .then(() => console.log('[SauceDemoSuiteGenerator] Done.'))
    .catch((err) => {
      console.error('[SauceDemoSuiteGenerator] Error:', err);
      process.exit(1);
    });
}
