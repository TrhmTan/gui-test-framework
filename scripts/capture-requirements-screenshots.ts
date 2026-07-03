import { chromium } from 'playwright';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { appConfig } from '../src/core/ConfigLoader';
import { formatWorksheet } from './format-excel';

// Load cấu hình từ ConfigLoader
const ENV = appConfig.currentEnv;
const BASE_URL = appConfig.baseUrl;
const HEADLESS = appConfig.isHeadless;

const EXCEL_PATH = path.resolve(process.cwd(), 'data/Tiem_Chung/L1_High_Level/9.1_Sang_loc/HL_FR_9.1.2_Danh_Gia_Ban_Dau.xlsx');
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'data/Tiem_Chung/L1_High_Level/screenshots/9.1.2');

// Thông tin tài khoản — bắt buộc lấy từ biến môi trường, không có giá trị mặc định
const USERNAME = process.env.QA_USERNAME;
const PASSWORD = process.env.QA_PASSWORD;
const HOSPITAL_NAME = process.env.HOSPITAL_NAME; // Tên rút gọn để dễ tìm kiếm
if (!USERNAME || !PASSWORD || !HOSPITAL_NAME) {
  throw new Error(
    'Missing required environment variables: QA_USERNAME, QA_PASSWORD, HOSPITAL_NAME must all be set (e.g. via config/credentials.env).'
  );
}

async function runCapture() {
  console.log(`🚀 Starting screenshot capture on Environment: ${ENV.toUpperCase()} | URL: ${BASE_URL}`);

  // Đảm bảo thư mục screenshot tồn tại
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    console.log(`📁 Created screenshot directory: ${SCREENSHOT_DIR}`);
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  
  // Cấu hình context options (xử lý Basic Auth nếu chạy local)
  const contextOptions: any = {
    viewport: { width: 1440, height: 900 }
  };

  if (ENV === 'local') {
    contextOptions.httpCredentials = {
      username: appConfig.credentials.LOCAL_HTTP_USER,
      password: appConfig.credentials.LOCAL_HTTP_PASS
    };
    console.log(`🔒 Basic Auth configured for local: user=${contextOptions.httpCredentials.username}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // 1. Điều hướng tới trang login
    const loginUrl = `${BASE_URL}/login`;
    console.log(`🔗 Navigating to login: ${loginUrl}`);
    await page.goto(loginUrl);
    await page.waitForTimeout(4000);

    // 2. Thực hiện đăng nhập
    console.log('🔑 Performing login steps...');
    const ssoBtn = page.locator('[data-testid="auth-login-primary-button"]');
    if (await ssoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('-> Clicking SSO login button...');
      await ssoBtn.click();
      await page.waitForTimeout(3000);
    }

    // Điền tài khoản bằng bộ định vị linh hoạt cho cả Keycloak và Local SSO
    const userField = page.locator('#username, #email, input[name="username"], input[name="email"]').first();
    await userField.waitFor({ state: 'visible', timeout: 5000 });
    await userField.fill(USERNAME);

    const passField = page.locator('#password, input[name="password"]').first();
    await passField.fill(PASSWORD);

    // Click nút đăng nhập
    const loginBtn = page.locator('#kc-login, button:has-text("Đăng nhập với SSO"), button:has-text("Đăng nhập"), button[type="submit"]').first();
    await loginBtn.click();

    // Chờ điều hướng
    await page.waitForTimeout(6000);

    // 3. Chọn bệnh viện nếu hiển thị trang chọn bệnh viện
    const hospitalCard = page.locator(`//div[contains(@class, 'bg-card') and .//h3[contains(text(), '${HOSPITAL_NAME}')]]//*[contains(text(), 'Chọn Bệnh Viện')]`).first();
    if (await hospitalCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`-> Clicking hospital selection containing name: ${HOSPITAL_NAME}`);
      await hospitalCard.click();
      await page.waitForTimeout(5000);
    }

    // Chờ trang dashboard load hoàn tất
    console.log('-> Waiting for main dashboard/command center to load...');
    await page.waitForTimeout(4000);

    // 4. Di chuyển tới trang Đánh giá ban đầu / Hàng đợi
    const screeningUrl = `${BASE_URL}/vaccination/screening`;
    console.log(`🔗 Navigating to screening page: ${screeningUrl}`);
    await page.goto(screeningUrl);
    await page.waitForTimeout(5000);

    // Chụp hình 1: Dashboard / Hàng đợi chính
    const dashboardPath = path.join(SCREENSHOT_DIR, '9.1.2_dashboard.png');
    console.log(`📸 Capturing: 9.1.2_dashboard.png`);
    await page.screenshot({ path: dashboardPath });
    console.log(`✅ Saved: ${dashboardPath}`);

    // Chụp hình 2: Form đo sinh hiệu cho khách hàng sẵn có
    console.log('-> Attempting to open exist customer vitals form...');
    const screeningBtn = page.locator('text=Chờ đo chỉ số sinh tồn, button:has-text("Chờ đo chỉ số"), [data-testid*="screening"]').first();
    let capturedExist = false;

    if (await screeningBtn.count() > 0 && await screeningBtn.isVisible()) {
      console.log('-> Found waiting customer, clicking to open form...');
      await screeningBtn.click();
      await page.waitForTimeout(4000); // Chờ popup hiển thị hoàn chỉnh

      const existCustomerPath = path.join(SCREENSHOT_DIR, '9.1.2_do_chi_so_exist_customer.png');
      console.log(`📸 Capturing: 9.1.2_do_chi_so_exist_customer.png`);
      await page.screenshot({ path: existCustomerPath });
      console.log(`✅ Saved: ${existCustomerPath}`);
      capturedExist = true;

      // Đóng popup bằng cách quay lại trang screening
      console.log('-> Closing popup by reloading screening page...');
      await page.goto(screeningUrl);
      await page.waitForTimeout(4000);
    } else {
      console.log('⚠️ Warning: No waiting customer found in queue! Cannot capture exist customer vitals form.');
    }

    // Chụp hình 3: Tiếp đón vãng lai - Tạo khách hàng mới
    console.log('-> Attempting to open vãng lai new customer registration form...');
    const receptionBtn = page.locator('text=Tiếp đón khách vãng lai').first();
    if (await receptionBtn.count() > 0) {
      console.log('-> Clicking "Tiếp đón khách vãng lai" button...');
      await receptionBtn.click();
      await page.waitForTimeout(3000);

      // Bật toggle "Tạo khách mới" bằng selector chuẩn
      console.log('-> Toggling "Tạo khách mới" switch ON...');
      const createNewToggle = page.locator('text=Tạo khách mới').first();
      await createNewToggle.click();
      await page.waitForTimeout(3000); // Chờ form mở rộng ra hoàn chỉnh

      const newCustomerPath = path.join(SCREENSHOT_DIR, '9.1.2_do_chi_so_new_customer.png');
      console.log(`📸 Capturing: 9.1.2_do_chi_so_new_customer.png`);
      await page.screenshot({ path: newCustomerPath });
      console.log(`✅ Saved: ${newCustomerPath}`);
    } else {
      console.log('⚠️ Warning: Button "Tiếp đón khách vãng lai" not found on page!');
    }

    // 5. Cập nhật file Excel FR_9.1.2.xlsx
    console.log(`📝 Updating Excel file: ${EXCEL_PATH}`);
    if (!fs.existsSync(EXCEL_PATH)) {
      throw new Error(`Excel file not found at path: ${EXCEL_PATH}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_PATH);
    const sheet = workbook.getWorksheet('FR_9.1.2') || workbook.worksheets[0];

    if (!sheet) {
      throw new Error('No worksheet found in Excel!');
    }

    // Cập nhật cấu trúc header L1 (5 cột chuẩn)
    sheet.getCell(1, 1).value = 'FR';
    sheet.getCell(1, 2).value = 'YC';
    sheet.getCell(1, 3).value = 'summary';
    sheet.getCell(1, 4).value = 'hl_tc_id';
    sheet.getCell(1, 5).value = '[o]_component';

    // Format sheet
    formatWorksheet(sheet);

    // Lưu file Excel
    await workbook.xlsx.writeFile(EXCEL_PATH);
    cons