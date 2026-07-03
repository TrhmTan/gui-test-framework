import { chromium } from 'playwright';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { appConfig } from '../src/core/ConfigLoader';
import { formatWorksheet } from './format-excel';

// Load cấu hình từ ConfigLoader
const HEADLESS = appConfig.isHeadless;

// Thông tin tài khoản — bắt buộc lấy từ biến môi trường, không có giá trị mặc định
const USERNAME = process.env.QA_USERNAME;
const PASSWORD = process.env.QA_PASSWORD;
const HOSPITAL_NAME = process.env.HOSPITAL_NAME;
if (!USERNAME || !PASSWORD || !HOSPITAL_NAME) {
  throw new Error(
    'Missing required environment variables: QA_USERNAME, QA_PASSWORD, HOSPITAL_NAME must all be set (e.g. via config/credentials.env).'
  );
}

async function run() {
  const args = process.argv.slice(2);
  const fileArg = args.find(arg => arg.startsWith('--file='));
  const urlArg = args.find(arg => arg.startsWith('--url='));
  const menuArg = args.find(arg => arg.startsWith('--menu='));
  const screenshotDirArg = args.find(arg => arg.startsWith('--screenshot-dir='));

  if (!fileArg || !urlArg || !screenshotDirArg) {
    console.error('❌ Lỗi: Thiếu tham số bắt buộc.');
    console.error('Ví dụ: npx ts-node scripts/capture-checklist-info.ts --file=data/<module>/L1_High_Level/<sub>/<file>.xlsx --url=https://api.example.com/your-page --screenshot-dir=data/<module>/L1_High_Level/screenshots/<sub>');
    process.exit(1);
  }

  const relativeExcelPath = fileArg.split('=')[1];
  const targetUrl = urlArg.split('=')[1];
  const menuText = menuArg ? menuArg.split('=')[1] : null;
  const relativeScreenshotDir = screenshotDirArg.split('=')[1];

  const excelPath = path.resolve(process.cwd(), relativeExcelPath);
  const excelFilename = path.basename(excelPath, '.xlsx');
  
  // Trích xuất mã số module (ví dụ: 9.1.2 từ FR_9.1.2 hoặc 9.2.2 từ FR_9.2.2)
  const prefixMatch = excelFilename.match(/\d+(\.\d+)*/);
  const prefix = prefixMatch ? prefixMatch[0] : '9.1.2';

  let screenshotDir = path.resolve(process.cwd(), relativeScreenshotDir);
  // Tự động điều chỉnh thư mục screenshot để khớp với prefix nhằm tránh tạo thư mục chung '9.1'
  if (!screenshotDir.endsWith(prefix)) {
    if (path.basename(screenshotDir) === '9.1') {
      screenshotDir = path.join(path.dirname(screenshotDir), prefix);
    } else {
      screenshotDir = path.join(screenshotDir, prefix);
    }
  }

  console.log(`🚀 Starting capture checklist info for prefix: ${prefix} | Target Menu: ${menuText || 'Auto-detect'}`);
  
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Lỗi: Không tìm thấy file Excel tại ${excelPath}`);
    process.exit(1);
  }

  // Đảm bảo thư mục screenshot tồn tại
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    console.log(`📁 Created screenshot directory: ${screenshotDir}`);
  }

  // Khởi chạy trình duyệt
  const browser = await chromium.launch({ headless: HEADLESS });
  const contextOptions: any = {
    viewport: { width: 1440, height: 900 }
  };

  // Cấu hình Basic Auth cho môi trường local
  const urlObj = new URL(targetUrl);
  const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname.startsWith('10.');
  
  if (isLocal) {
    contextOptions.httpCredentials = {
      username: appConfig.credentials.LOCAL_HTTP_USER,
      password: appConfig.credentials.LOCAL_HTTP_PASS
    };
    console.log(`🔒 Basic Auth configured: user=${contextOptions.httpCredentials.username}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // 1. Điều hướng tới trang login
    const loginUrl = `${urlObj.origin}/login`;
    console.log(`🔗 Navigating to login: ${loginUrl}`);
    await page.goto(loginUrl);
    await page.waitForTimeout(4000);

    // 2. Thực hiện đăng nhập
    console.log('🔑 Performing login steps...');
    const ssoBtn = page.locator('[data-testid="auth-login-primary-button"]');
    if (await ssoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ssoBtn.click();
      await page.waitForTimeout(3000);
    }

    const userField = page.locator('#username, #email, input[name="username"], input[name="email"]').first();
    await userField.waitFor({ state: 'visible', timeout: 5000 });
    await userField.fill(USERNAME);

    const passField = page.locator('#password, input[name="password"]').first();
    await passField.fill(PASSWORD);

    const loginBtn = page.locator('#kc-login, button:has-text("Đăng nhập với SSO"), button:has-text("Đăng nhập"), button[type="submit"]').first();
    await loginBtn.click();
    await page.waitForTimeout(6000);

    // 3. Chọn bệnh viện nếu hiển thị
    const hospitalCard = page.locator(`//div[contains(@class, 'bg-card') and .//h3[contains(text(), '${HOSPITAL_NAME}')]]//*[contains(text(), 'Chọn Bệnh Viện')]`).first();
    if (await hospitalCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`-> Clicking hospital selection: ${HOSPITAL_NAME}`);
      await hospitalCard.click();
      await page.waitForTimeout(5000);
    }

    // 4. Click menu bên trái theo text hoặc tự nhận diện
    const menuToClick = menuText || prefix;
    console.log(`🧭 Locating left menu item containing: "${menuToClick}"`);
    
    // Tìm phần tử menu
    const menuContainer = page.locator(`aside, nav, .sidebar, [class*="sidebar"], [class*="menu"]`);
    const menuItem = menuText 
      ? menuContainer.locator(`text="${menuText}"`).first()
      : menuContainer.locator(`a, button, li, [role="menuitem"], div, span`).filter({ hasText: prefix }).first();
    
    if (await menuItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`-> Clicking menu item containing "${menuToClick}"...`);
      await menuItem.click();
      await page.waitForTimeout(5000);
    } else {
      console.log(`⚠️ Warning: Menu item containing "${menuToClick}" not found, navigating directly to ${targetUrl}`);
      await page.goto(targetUrl);
      await page.waitForTimeout(5000);
    }

    // 5. Chụp ảnh màn hình dashboard chính
    const dashboardFilename = `${prefix}_dashboard.png`;
    const dashboardPath = path.join(screenshotDir, dashboardFilename);
    console.log(`📸 Capturing: ${dashboardFilename}`);
    await page.screenshot({ path: dashboardPath });
    console.log(`✅ Saved: ${dashboardPath}`);

    let capturedExist = false;
    let capturedNew = false;
    
    // 6. Xử lý chụp ảnh nâng cao tùy theo module
    if (prefix === '9.1.2') {
      // Module Screening: Tiếp đón vãng lai và Đo chỉ số
      console.log('-> Screening module detected. Capturing detail forms...');
      
      // Chụp trạng thái 1: Tiếp đón vãng lai (Toggle Tạo khách mới = OFF)
      const receptionBtn = page.locator('text=Tiếp đón khách vãng lai').first();
      if (await receptionBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await receptionBtn.click();
        await page.waitForTimeout(3000);
        
        const existCustomerFilename = `${prefix}_do_chi_so_exist_customer.png`;
        const existCustomerPath = path.join(screenshotDir, existCustomerFilename);
        console.log(`📸 Capturing: ${existCustomerFilename}`);
        await page.screenshot({ path: existCustomerPath });
        capturedExist = true;

        // Bật toggle "Tạo khách mới"
        const createNewToggle = page.locator('text=Tạo khách mới').first();
        if (await createNewToggle.isVisible()) {
          await createNewToggle.click();
          await page.waitForTimeout(3000);
          
          const newCustomerFilename = `${prefix}_do_chi_so_new_customer.png`;
          const newCustomerPath = path.join(screenshotDir, newCustomerFilename);
          console.log(`📸 Capturing: ${newCustomerFilename}`);
          await page.screenshot({ path: newCustomerPath });
          capturedNew = true;
        }
      }
    } else if (prefix === '9.2.2') {
      // Module Monitoring: Theo dõi sau tiêm
      console.log('-> Monitoring module detected. Capturing detail forms...');
      
      // Click chọn khách hàng đầu tiên trong hàng đợi để mở form theo dõi
      const queueRow = page.locator('tbody tr, .queue-item, [class*="table-row"]').first();
      if (await queueRow.isVisible({ timeout: 4000 }).catch(() => false)) {
        console.log('-> Found customer in queue, clicking to open form...');
        await queueRow.click();
        await page.waitForTimeout(4000);

        const formFilename = `${prefix}_form_ghi_nhan.png`;
        const formPath = path.join(screenshotDir, formFilename);
        console.log(`📸 Capturing: ${formFilename}`);
        await page.screenshot({ path: formPath });
        capturedExist = true; // gán cờ để ánh xạ
      } else {
        console.log('⚠️ Warning: No customer found in queue for Monitoring screen.');
      }
    } else if (prefix === '9.1.3') {
      console.log('-> Screening doctor module detected. Capturing detail forms...');
      
      // Chọn phòng khám trước
      const roomSelect = page.locator('[role="combobox"]').filter({ hasText: /phòng|Phòng/ }).first();
      if (await roomSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('-> Clicking clinic room selector dropdown...');
        await roomSelect.click();
        await page.waitForTimeout(2000);

        // Lấy tất cả các phòng khám trong dropdown
        const roomOptions = page.locator('[role="option"], [class*="select-item"], [class*="-option-content"]');
        
        // Chờ ít nhất một option hiển thị trước khi đếm
        await roomOptions.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        
        const roomCount = await roomOptions.count().catch(() => 0);
        console.log(`-> Found ${roomCount} room options in dropdown.`);

        let selectedSuccess = false;
        for (let i = 0; i < roomCount; i++) {
          const roomOption = roomOptions.nth(i);
          const roomText = await roomOption.innerText().catch(() => `Room ${i + 1}`);
          console.log(`-> Selecting room option: ${roomText}`);
          
          await roomOption.click();
          await page.waitForTimeout(4000); // Chờ bảng load dữ liệu khách hàng

          // Kiểm tra xem hàng đợi có bệnh nhân nào không
          const queueRow = page.locator('[data-testid^="screening-doctor-queue-row-"], tbody tr, .queue-item, [class*="table-row"]').first();
          if (await queueRow.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`✅ Success: Found customer in queue for room "${roomText}"!`);
            selectedSuccess = true;
            
            // Chụp lại dashboard sau khi chọn phòng
            console.log('📸 Recapturing dashboard with clinic room selected...');
            await page.screenshot({ path: dashboardPath });
            break;
          } else {
            console.log(`⚠️ Room "${roomText}" queue is empty. Re-opening selector...`);
            if (i < roomCount - 1) {
              await roomSelect.click();
              await page.waitForTimeout(2000);
            }
          }
        }

        if (!selectedSuccess) {
          console.log('⚠️ Warning: Checked all room options but found no customer in queue!');
        }
      }

      // Click dòng bệnh nhân đầu tiên trong hàng đợi khám bác sĩ
      const queueRow = page.locator('[data-testid^="screening-doctor-queue-row-"], tbody tr, .queue-item, [class*="table-row"]').first();
      if (await queueRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('-> Found customer in queue, clicking to open doctor form...');
        await queueRow.click();
        await page.waitForTimeout(5000); // Chờ form mở rộng ra

        // Chờ tab Sinh hiệu xuất hiện và click vào nó để đảm bảo giao diện Sinh hiệu hiển thị
        const sinhHieuTab = page.locator('text=Sinh hiệu, button:has-text("Sinh hiệu"), [data-testid*="sinh-hieu"], div:has-text("Sinh hiệu")').first();
        if (await sinhHieuTab.isVisible({ timeout: 4000 }).catch(() => false)) {
          console.log('-> Found "Sinh hiệu" tab, clicking to switch...');
          await sinhHieuTab.click();
          await page.waitForTimeout(3000);
        }

        const sinhHieuFilename = `${prefix}_sinh_hieu.png`;
        const sinhHieuPath = path.join(screenshotDir, sinhHieuFilename);
        console.log(`📸 Capturing: ${sinhHieuFilename}`);
        await page.screenshot({ path: sinhHieuPath });
        capturedExist = true; // Đánh dấu đã chụp ảnh sinh hiệu thành công
      } else {
        console.log('⚠️ Warning: No customer found in screening queue after selecting clinic room!');
      }
    }

    // 7. Cập nhật file Excel checklist
    console.log(`📝 Updating Excel file: ${excelPath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const sheet = workbook.getWorksheet(excelFilename) || workbook.worksheets[0];

    if (!sheet) {
      throw new Error('No worksheet found in Excel!');
    }

    // Cập nhật cấu trúc header L1 (5 cột chuẩn)
    sheet.getCell(1, 1).value = 'FR';
    sheet.getCell(1, 2).value = 'YC';
    sheet.getCell(1, 3).value = 'summary';
    sheet.getCell(1, 4).value = 'hl_tc_id';
    sheet.getCell(1, 5).value = '[o]_component';

    // Định dạng và lưu file
    formatWorksheet(sheet);
    await workbook.xlsx.writeFile(excelPath);
    console.log(`🎉 [Excel Update] Successfully updated he