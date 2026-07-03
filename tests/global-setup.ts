import { FullConfig, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../playwright.config';
import { ExcelReader } from '../src/core/ExcelReader';
import { ResultWriter } from '../src/core/ResultWriter';
import * as ExcelJS from 'exceljs';
import { formatExcelFile } from '../scripts/format-excel';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { appConfig } from '../src/core/ConfigLoader';
import { LocatorResolver } from '../src/core/LocatorResolver';

/** Đường dẫn file lưu session đã login (storageState) */
export const STORAGE_STATE_PATH = path.resolve(__dirname, '../.run/storage-state.json');


/**
 * Kiểm tra trạng thái hoạt động của Server (Health Check)
 */
function checkServerHealth(targetUrl: string, timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(targetUrl, { timeout: timeoutMs }, (res) => {
        // Có phản hồi socket là server còn chạy (kể cả lỗi status code)
        req.destroy();
        resolve(true);
      });

      req.on('error', (err) => {
        console.error(`[GlobalSetup] Health check error for ${targetUrl}:`, err.message);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        console.error(`[GlobalSetup] Health check timeout for ${targetUrl}`);
        resolve(false);
      });
    } catch (e: any) {
      console.error(`[GlobalSetup] Invalid health check URL: ${targetUrl}`, e.message);
      resolve(false);
    }
  });
}

async function globalSetup(playwrightConfig: FullConfig) {
  // 0. Xác định file Excel kịch bản gốc và làm sạch kết quả cũ
  const originalExcel = config.excelPath;
  if (!fs.existsSync(originalExcel)) {
    throw new Error(`[GlobalSetup] Không tìm thấy file kịch bản gốc tại: ${originalExcel}`);
  }

  try {
    const moduleFilter = process.env.MODULE_FILTER;
    if (process.env.DISABLE_ORIGINAL_EXCEL_WRITE !== 'true') {
      console.log(`[GlobalSetup] Đang làm sạch kết quả cũ trong file Excel gốc...`);
      const setupWriter = new ResultWriter(originalExcel);
      await setupWriter.clearTestResults(moduleFilter);
    } else {
      console.log(`[GlobalSetup] Chạy đa môi trường song song: Bỏ qua làm sạch file Excel gốc [${path.basename(originalExcel)}] để tránh tranh chấp I/O.`);
    }

    // 1. Kiểm tra Health Check của Môi trường
    const baseUrl = config.baseUrl;
    console.log(`[GlobalSetup] Đang kiểm tra sức khỏe server (Health Check) tại: ${baseUrl}...`);
    let healthCheckUrl = baseUrl;
    if (appConfig.currentEnv === 'local' && appConfig.credentials.LOCAL_HTTP_USER) {
      try {
        const parsedUrl = new URL(baseUrl);
        parsedUrl.username = appConfig.credentials.LOCAL_HTTP_USER;
        parsedUrl.password = appConfig.credentials.LOCAL_HTTP_PASS;
        healthCheckUrl = parsedUrl.toString();
      } catch (e: any) {
        console.error(`[GlobalSetup] Error injecting auth to health check URL:`, e.message);
      }
    }
    const isAlive = await checkServerHealth(healthCheckUrl, 5000);
    if (!isAlive) {
      console.error(`\n========================================================================`);
      console.error(`❌❌ [HEALTH CHECK FAILED] Server của môi trường tại [${baseUrl}] KHÔNG HOẠT ĐỘNG!`);
      console.error(`Có thể server bị tắt, lỗi mạng, hoặc bạn cần kết nối VPN để truy cập.`);
      console.error(`Tiến trình test sẽ bị hủy ngay lập tức để tiết kiệm thời gian.`);
      console.error(`========================================================================\n`);
      throw new Error(`[GlobalSetup] Server is down at ${baseUrl}. Aborting test execution.`);
    }
    console.log(`[GlobalSetup] Health check PASSED! Server đang hoạt động.`);

    // 1. Tạo timestamp
    const now = new Date();
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    // Thêm thông tin môi trường vào runId để dễ phân biệt (ví dụ: LOCAL, SIT, UAT, TEST)
    const envLabel = (process.env.TEST_ENV || 'local').toUpperCase();
    const excelName = path.basename(originalExcel, '.xlsx');
    const runIdPrefix = process.env.RUN_ID_PREFIX ? `${process.env.RUN_ID_PREFIX}_` : `${excelName}_`;
    const runId = `run_${envLabel}_${runIdPrefix}${timestamp}`;
    const runReportDir = path.join(config.reportsDir, runId);
    const screenshotsDir = path.join(runReportDir, 'screenshots');

    // 2. Tạo các thư mục báo cáo
    if (!fs.existsSync(config.reportsDir)) {
      fs.mkdirSync(config.reportsDir, { recursive: true });
    }
    fs.mkdirSync(runReportDir, { recursive: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // 4. Nhân bản sang file Excel kết quả của lượt chạy này
    const resultExcel = path.join(runReportDir, `${excelName}_${envLabel}_result.xlsx`);
    fs.copyFileSync(originalExcel, resultExcel);

    // Định dạng lại toàn bộ file kết quả trước khi test engine đọc
    try {
      await formatExcelFile(resultExcel);
    } catch (formatErr: any) {
      console.warn(`[GlobalSetup] Warning: Không thể tự động định dạng file Excel kết quả:`, formatErr.message);
    }

    // 5. Đọc file Excel và parse thành cấu trúc JSON kịch bản
    console.log(`[GlobalSetup] Parsing Excel kịch bản sang JSON...`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(originalExcel);

    const modulesToRun: any[] = [];
    const allTestCases: Record<string, { steps: any[]; moduleName: string }> = {};
    const reader = new ExcelReader(originalExcel);

    // Đọc danh sách pages và phân giải URL tương đối/tuyệt đối động theo môi trường
    const originalPages = await reader.readPages();
    const pages = originalPages.map(p => {
      let resolvedUrl = p.url;
      if (p.url.startsWith('/')) {
        // Nếu là URL tương đối, ví dụ: /login
        resolvedUrl = `${baseUrl}${p.url}`;
      } else if (p.url.startsWith('http://') || p.url.startsWith('https://')) {
        // Nếu là URL tuyệt đối, ví dụ: https://test.example.com/login
        // Tự động thay thế origin cũ bằng baseUrl mới để tương thích ngược
        try {
          const parsedOriginal = new URL(p.url);
          const parsedBase = new URL(baseUrl);
          resolvedUrl = `${parsedBase.origin}${parsedOriginal.pathname}${parsedOriginal.search}`;
        } catch (e) {
          // Giữ nguyên nếu lỗi
        }
      }
      return {
        page_key: p.page_key,
        url: resolvedUrl
      };
    });
    console.log(`[GlobalSetup] Đã phân giải URL cho ${pages.length} trang theo môi trường.`);

    // Đọc dữ liệu DATA_LOGIN
    let loginData: any[] = [];
    try {
      loginData = await reader.readTestData('login');
      console.log(`[GlobalSetup] Đã nạp thành công ${loginData.length} hàng dữ liệu login.`);
    } catch (e: any) {
      console.warn(`[GlobalSetup] Warning: Không thể đọc dữ liệu DATA_LOGIN:`, e.message);
    }

    // Đọc dữ liệu ELEMENT_LOGIN
    let loginElements: any[] = [];
    try {
      loginElements = await reader.readElements('login');
      console.log(`[GlobalSetup] Đã nạp thành công ${loginElements.length} elements login.`);
    } catch (e: any) {
      console.warn(`[GlobalSetup] Warning: Không thể đọc elements LOGIN:`, e.message);
    }

    // Đọc dữ liệu PRECONDITION
    let preconditionTestCases: any[] = [];
    try {
      preconditionTestCases = await reader.readPreconditionTestCases();
      console.log(`[GlobalSetup] Đã nạp thành công ${preconditionTestCases.length} kịch bản tiền đề.`);
    } catch (e: any) {
      console.warn(`[GlobalSetup] Warning: Không thể đọc kịch bản PRECONDITION:`, e.message);
    }

    for (const sheet of workbook.worksheets) {
      const sheetName = sheet.name;
      if (sheetName.startsWith('TEST_CASE_')) {
        const moduleName = sheetName.substring('TEST_CASE_'.length).toLowerCase();

        const testCases = await reader.readTestCases(moduleName, true);
        const elements = await reader.readElements(moduleName);
        const testData = await reader.readTestData(moduleName);

        if (testCases.length > 0) {
          modulesToRun.push({
            moduleName,
            testCases,
            elements,
            testData
          });
        }

        // Đọc toàn bộ test cases (gồm cả không chạy) để lưu vào map allTestCases phục vụ phân tích/truy vết kịch bản
        const allTestCasesInSheet = await reader.readTestCases(moduleName, false);

        // Thực hiện validate kịch bản Excel của module này trước khi chạy test
        validateModuleConfig(moduleName, allTestCasesInSheet, testCases, testData, moduleFilter);

        for (const tc of allTestCasesInSheet) {
          allTestCases[tc.tc_id] = {
            steps: tc.steps,
            moduleName
          };
        }
      }
    }

    const scenariosJsonPath = path.join(runReportDir, 'scenarios.json');
    const payload = {
      pages,
      modules: modulesToRun,
      preconditionTestCases,
      allTestCases,
      loginData,
      loginElements
    };
    fs.writeFileSync(scenariosJsonPath, JSON.stringify(payload, null, 2), 'utf-8');

    // 6. Lưu thông tin vào biến môi trường và file tĩnh
    process.env.RUN_ID = runId;
    process.env.RUN_REPORT_DIR = runReportDir;
    process.env.RESULT_EXCEL_PATH = resultExcel;
    process.env.SCENARIOS_JSON_PATH = scenariosJsonPath;

    // Lưu active_run_info vào .run/ (folder ẩn) — một file riêng theo từng Excel (tránh overwrite khi parallel)
    const runInfoDir = path.resolve(__dirname, '../.run');
    if (!fs.existsSync(runInfoDir)) fs.mkdirSync(runInfoDir, { recursive: true });
    const runInfoSuffix = process.env.RUN_ID_PREFIX ? `_${process.env.RUN_ID_PREFIX}` : '';
    const activeRunInfoPath = path.join(runInfoDir, `active_run_info${runInfoSuffix}.json`);
    fs.writeFileSync(activeRunInfoPath, JSON.stringify({
      runId,
      runReportDir,
      resultExcelPath: resultExcel,
      originalExcelPath: originalExcel,
      scenariosJsonPath
    }, null, 2), 'utf-8');

    // 7. Login 1 lần duy nhất và lưu storageState để tái sử dụng cho toàn bộ test suite
    //    → Tránh re-login sau mỗi TC fail, giữ browser session liên tục
    await performLoginAndSaveSession(baseUrl, preconditionTestCases, pages, loginElements);

    console.log(`[GlobalSetup] Session initialized: ${runId}`);
    console.log(`[GlobalSetup] Scenarios JSON created at: ${scenariosJsonPath}`);
  } catch (error: any) {
    if (error.code === 'EBUSY' || (error.message && error.message.includes('busy or locked'))) {
      console.error(`\n❌ [LỖI KHÓA FILE] Có cửa sổ Microsoft Excel nào đang mở file kịch bản này không, hãy đóng hẳn nó lại.\n`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Thực hiện login 1 lần và lưu storageState (cookies + localStorage) vào file.
 * File này sẽ được dùng bởi tất cả browser context trong test suite,
 * giúp bỏ qua bước login lặp lại sau mỗi TC bị fail.
 */
async function performLoginAndSaveSession(
  baseUrl: string,
  preconditionTestCases: any[],
  pages: any[],
  loginElements: any[]
): Promise<void> {
  // Nếu đã có storageState còn mới (< 2 tiếng) → tái sử dụng, không login lại
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    const stat = fs.statSync(STORAGE_STATE_PATH);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 2 * 60 * 60 * 1000) { // < 2 giờ
      console.log(`[GlobalSetup] ♻️  Tái sử dụng session đã lưu (${Math.round(ageMs / 60000)} phút trước).`);
      return;
    }
  }

  const loginPrecondition = preconditionTestCases.find(
    (tc: any) => tc.tc_id === 'pre_super_admin_login_success'
  );
  if (!loginPrecondition) {
    console.warn('[GlobalSetup] ⚠️  Không tìm thấy precondition login — bỏ qua storageState.');
    return;
  }

  console.log('[GlobalSetup] 🔑 Đang login lần đầu để lưu session (storageState)...');

  const httpCredentials = appConfig.currentEnv === 'local' && appConfig.credentials.LOCAL_HTTP_USER
    ? { username: appConfig.credentials.LOCAL_HTTP_USER, password: appConfig.credentials.LOCAL_HTTP_PASS }
    : undefined;

  const browser = await chromium.launch({ headless: appConfig.isHeadless });
  const context = await browser.newContext(httpCredentials ? { httpCredentials } : {});
  const page = await context.newPage();

  try {
    const pagesMap = new Map<string, string>(pages.map((p: any) => [p.page_key, p.url]));
    const locatorResolver = new LocatorResolver(loginElements);

    for (const step of loginPrecondition.steps) {
      const target = step.target || '';
      const value  = step.value  || '';
      const action = (step.action || '').toLowerCase();
      const expected = (step.expected || '').toLowerCase();

      // Phân giải locator động
      let locatorStr = locatorResolver.resolve(target, value);

      // Xử lý override locator cho local env
      if (appConfig.currentEnv === 'local') {
        if (target === 'txt_username') locatorStr = '#email';
        else if (target === 'txt_password') locatorStr = '#password';
        else if (target === 'btn_login') locatorStr = 'button:has-text("Đăng nhập với SSO")';
      }

      console.log(`[GlobalSetup] Step ${step.step}: ${action} on target: ${target} (${locatorStr || 'N/A'}) with value: "${value}"`);

      if (action === 'navigate') {
        let url = pagesMap.get(target) || target;
        if (!url.startsWith('http')) url = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        continue;
      }

      // Bỏ qua click nếu element không hiện (trên mọi môi trường để tránh login timeout)
      if (action === 'click' && (target === 'btn_keycloak_sso' || target === 'btn_dynamic_select')) {
        const visible = locatorStr
          ? await page.locator(locatorStr).waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
          : false;
        if (!visible) {
          console.log(`[GlobalSetup] element ${target} không xuất hiện. Skip.`);
          continue;
        }
      }

      if (!locatorStr) {
        console.warn(`[GlobalSetup] Không phân giải được locator cho target: ${target}. Bỏ qua step.`);
        continue;
      }

      if (action === 'input' || action === 'fill') {
        await page.locator(locatorStr).fill(value);
      } else if (action === 'click') {
        await page.locator(locatorStr).click({ timeout: 15000 });
      } else if (action === 'check_status') {
        if (expected === 'visible') {
          await page.locator(locatorStr).waitFor({ state: 'visible', timeout: 15000 });
        } else if (expected === 'hidden') {
          await page.locator(locatorStr).waitFor({ state: 'hidden', timeout: 15000 });
        } else {
          // Mặc định hoặc đợi redirect hoàn tất
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        }
      }
    }

    // Đợi session ổn định
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Lưu storageState
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`[GlobalSetup] ✅ Session đã lưu tại: ${STORAGE_STATE_PATH}`);
  } catch (e: any) {
    console.warn(`[GlobalSetup] ⚠️  Không thể lưu storageState: ${e.message}`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Validate định dạng cấu hình của các Test Case trong một Module
 */
function validateModuleConfig(
  moduleName: string,
  allTestCases: any[],
  runnableTestCases: any[],
  testData: any[],
  moduleFilter?: string
): void {
  const runnableIds = new Set(runnableTestCases.map(tc => tc.tc_id));
  const isTargetModule = !moduleFilter || moduleFilter.toLowerCase() === moduleName.toLowerCase();

  for (const tc of allTestCases) {
    if (!tc.steps || tc.steps.length === 0) continue;

    const rawIsRun = (tc.is_run_raw || '').trim().toUpperCase();
    const isRunnable = runnableIds.has(tc.tc_id);

    // 1. Kiểm tra cột is_run: chỉ được phép là ON hoặc OFF (không phân biệt hoa thường)
    if (rawIsRun !== 'ON' && rawIsRun !== 'OFF') {
      const errorMsg = `[Excel Format Error] Sheet TEST_CASE_${moduleName.toUpperCase()} - Test Case [${tc.tc_id}]: Cột is_run mang giá trị '${tc.is_run_raw}' (yêu cầu bắt buộc là 'ON' hoặc 'OFF'). Người dùng nhập sai dữ liệu excel.`;
      if (isTargetModule) {
        console.error(`\n❌ ERROR: ${errorMsg}\n`);
        throw new Error(errorMsg);
      } else {
        console.warn(`\n⚠️ WARNING: ${errorMsg} (Bỏ qua vì không nằm trong module được chạy)\n`);
        continue;
      }
    }

    // 2. Kiểm tra tính đồng nhất của dữ liệu (Consistency Check)
    const hasReference = tc.steps.some((step: any) => step.value && (String(step.value).trim().startsWith('$') || String(step.value).includes('$data_')));
    const rawParam = (tc.parameterized_raw || '').trim().toUpperCase();

    if (hasReference) {
      // Trường hợp dùng tham chiếu ($)
      // TH1: parameterized khác Y
      if (rawParam !== 'Y') {
        const errorMsg = `[Excel Format Error] Sheet TEST_CASE_${moduleName.toUpperCase()} - Test Case [${tc.tc_id}]: Cột value sử dụng tham chiếu ($) nhưng cột parameterized mang giá trị '${tc.parameterized_raw}' (yêu cầu bắt buộc chọn 'Y'). Người dùng nhập sai dữ liệu excel.`;
        if (isRunnable && isTargetModule) {
          console.error(`\n❌ ERROR: ${errorMsg}\n`);
          throw new Error(errorMsg);
        } else {
          console.warn(`\n⚠️ WARNING: ${errorMsg} (Bỏ qua vì test case đang tắt hoặc không nằm trong module được chạy)\n`);
        }
      }

      // TH2: Cột type bị trống
      if (!tc.type || tc.type.trim() === '') {
        const errorMsg = `[Excel Format Error] Sheet TEST_CASE_${moduleName.toUpperCase()} - Test Case [${tc.tc_id}]: Cột value sử dụng tham chiếu ($) nhưng cột type bị trống. Người dùng nhập sai dữ liệu excel.`;
        if (isRunnable && isTargetModule) {
          console.error(`\n❌ ERROR: ${errorMsg}\n`);
          throw new Error(errorMsg);
        } else {
          console.warn(`\n⚠️ WARNING: ${errorMsg} (Bỏ qua vì test case đang tắt hoặc không nằm trong module được chạy)\n`);
        }
      }

      // TH3: Không có dòng dữ liệu nào khớp trong sheet DATA
      const hasMatchingData = testData.some((d: any) => {
        const tcId = tc.tc_id.toUpperCase();
        const tcType = tc.type.toLowerCase();
        const dataTcType = d.test_case_type.toLowerCase();

        if (dataTcType.toUpperCase() === tcId) return true;
        if (dataTcType === tcType) return true;

        const match = dataTcType.match(/^([a-z]+)_tc_(\d+)$/);
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
        const errorMsg = `[Excel Format Error] Sheet TEST_CASE_${moduleName.toUpperCase()} - Test Case [${tc.tc_id}]: Chọn parameterized = 'Y' với type = '${tc.type}' nhưng không tìm thấy dòng dữ liệu nào có test_case_type tương ứng trong sheet DATA_${moduleName.toUpperCase()}. Người dùng nhập sai dữ liệu excel.`;
        if (isRunnable && isTargetModule) {
          console.error(`\n❌ ERROR: ${errorMsg}\n`);
          throw new Error(errorMsg);
        } else {
          console.warn(`\n⚠️ WARNING: ${errorMsg} (Bỏ qua vì test case đang tắt hoặc không nằm trong module được chạy)\n`);
        }
      }
    } else {
      // Trường hợp không dùng tham chiếu
      // TH4: parameterized khác N
      if (rawParam !== 'N') {
        const errorMsg = `[Excel Format Error] Sheet TEST_CASE_${moduleName.toUpperCase()} - Test Case [${tc.tc_id}]: Không sử dụng tham chiếu dữ liệu ($) ở cột value nhưng cột parameterized mang giá trị '${tc.parameterized_raw}' (yêu cầu bắt buộc chọn 'N'). Người dùng nhập sai dữ liệu excel.`;
        if (isRunnable && isTargetModule) {
          console.error(`\n❌ ERROR: ${errorMsg}\n`);
          throw new Error(errorMsg);
        } else {
          console.warn(`\n⚠️ WARNING: ${errorMsg} (Bỏ qua vì test case đang tắt hoặc không nằm trong module được chạy)\n`);
        }
      }
    }
  }
}

export default globalSetup;
