import { test } from '@playwright/test';
import { ExcelReader } from '../src/core/ExcelReader';
import { DataResolver } from '../src/core/DataResolver';
import { LocatorResolver } from '../src/core/LocatorResolver';
import { ActionExecutor } from '../src/core/ActionExecutor';
import { ResultWriter } from '../src/core/ResultWriter';
import { appConfig } from '../src/core/ConfigLoader';
import { STORAGE_STATE_PATH } from './global-setup';
import * as fs from 'fs';
import * as path from 'path';

/** StorageState tồn tại → dùng để tạo context không cần login lại */
const storageStateOption = fs.existsSync(STORAGE_STATE_PATH)
  ? { storageState: STORAGE_STATE_PATH }
  : {};

/**
 * Xác định xem một URL có phải trang login hay không.
 * Trước đây hardcode `url.includes('/login')`, nhưng không phải app nào cũng có
 * path "/login" (vd: SauceDemo dùng domain gốc "/" làm trang login) dẫn đến
 * việc engine không nhận ra đang ở trang login, bỏ qua bước re-login cần thiết.
 * Giờ tra cứu URL login thực tế đã khai báo trong sheet PAGE (page_key === 'login'),
 * đồng thời vẫn giữ fallback '/login' để tương thích ngược với các app cũ.
 */
function isLoginPage(url: string, pages?: any[]): boolean {
  if (!url) return false;
  if (url === 'about:blank') return true;
  if (url.includes('/login')) return true;

  const loginPageEntry = pages?.find((p: any) => p.page_key === 'login');
  if (loginPageEntry?.url) {
    try {
      const loginPath = loginPageEntry.url.startsWith('http')
        ? new URL(loginPageEntry.url).pathname
        : loginPageEntry.url;
      const currentPath = url.startsWith('http') ? new URL(url).pathname : url;
      if (currentPath === loginPath) return true;
    } catch {
      if (url === loginPageEntry.url) return true;
    }
  }
  return false;
}


const FALLBACK_CHECKIN_LOCATORS: Record<string, string> = {
  btn_checkin_walkin: '[data-testid="screening-checkin-walkin"]',
  btn_toggle_create_new: '[data-testid="checkin-toggle-create-new"]',
  txt_new_fullname: '[data-testid="checkin-new-name"]',
  txt_new_dob: '[data-testid="checkin-new-dob"]',
  ddl_new_gender: '[data-testid="checkin-new-gender"]',
  txt_new_phone: '[data-testid="checkin-new-phone"]',
  txt_new_address: '[data-testid="checkin-new-address"]',
  ddl_vaccine_select: '[data-testid="checkin-vaccine-select"]',
  ddl_room_select: '[data-testid="checkin-room-select"]',
  btn_submit_checkin: 'button:has-text("Lưu tiếp đón")'
};

async function ensureQueueNotEmpty(page: any, locatorResolver: any, contextData?: any, dataResolver?: any) {
  // Kiểm tra xem có hàng chờ nào không
  const firstRowLocatorStr = locatorResolver.resolve('first_row', '') || '[data-testid^="screening-queue-row-"] >> nth=0, [data-testid^="screening-doctor-queue-row-"] >> nth=0';
  const firstRow = page.locator(firstRowLocatorStr);
  const count = await firstRow.count().catch(() => 0);
  if (count > 0 && await firstRow.first().isVisible().catch(() => false)) {
    return; // Đã có khách hàng trong hàng chờ, không cần checkin thêm
  }

  const originalUrl = page.url();
  const isDoctorPage = originalUrl.includes('/vaccination/screening-doctor');

  if (isDoctorPage) {
    console.error('\n❌ [Queue Recovery] HÀNG CHỜ KHÁM SÀNG LỌC ĐANG TRỐNG!');
    console.error('👉 Không thể tự động khôi phục hàng chờ từ trang Đánh giá ban đầu vì nghiệp vụ yêu cầu bệnh nhân phải được Điều dưỡng hoàn thành Đánh giá ban đầu và bấm "Chuyển khám sàng lọc".');
    console.error('👉 Vui lòng chạy test suite Đánh giá ban đầu (9.1.2) trước để chuyển bệnh nhân sang khám sàng lọc, hoặc tự chuẩn bị sẵn dữ liệu bệnh nhân chờ khám trên giao diện.\n');
    throw new Error('Hàng chờ Khám sàng lọc đang trống. Vui lòng chuẩn bị dữ liệu tiền đề (chạy suite 9.1.2 hoặc tạo tay bệnh nhân chuyển khám).');
  }

  console.log('⚠️ [Queue Recovery] Hàng chờ đang trống. Tự động tiếp đón khách vãng lai mới...');

  try {
    // Tương tác UI để tiếp đón khách vãng lai
    // 1. Click Tiếp đón khách vãng lai
    const btnCheckinStr = FALLBACK_CHECKIN_LOCATORS['btn_checkin_walkin'];
    if (!btnCheckinStr) return;
    await page.locator(btnCheckinStr).click();
    await page.waitForTimeout(500);

    // 2. Click Tạo mới hồ sơ
    const btnToggleNewStr = FALLBACK_CHECKIN_LOCATORS['btn_toggle_create_new'];
    if (btnToggleNewStr) {
      await page.locator(btnToggleNewStr).click();
      await page.waitForTimeout(500);
    }

    // 3. Nhập Họ tên
    const txtNameStr = FALLBACK_CHECKIN_LOCATORS['txt_new_fullname'];
    if (txtNameStr) {
      const testName = `KH Test Auto ${Date.now().toString().slice(-6)}`;
      await page.locator(txtNameStr).fill(testName);
    }

    // 4. Nhập Ngày sinh
    const txtDobStr = FALLBACK_CHECKIN_LOCATORS['txt_new_dob'];
    if (txtDobStr) {
      await page.locator(txtDobStr).fill('1990-10-20');
    }

    // 5. Chọn Giới tính
    const ddlGenderStr = FALLBACK_CHECKIN_LOCATORS['ddl_new_gender'];
    if (ddlGenderStr) {
      await page.locator(ddlGenderStr).click();
      await page.locator('role=option[name="Nam"]').click().catch(() => page.locator('role=option').first().click());
    }

    // 6. Nhập Số điện thoại
    const txtPhoneStr = FALLBACK_CHECKIN_LOCATORS['txt_new_phone'];
    if (txtPhoneStr) {
      const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      await page.locator(txtPhoneStr).fill(randomPhone);
    }

    // 7. Nhập Địa chỉ
    const txtAddressStr = FALLBACK_CHECKIN_LOCATORS['txt_new_address'];
    if (txtAddressStr) {
      await page.locator(txtAddressStr).fill('Hà Nội');
    }

    // 8. Chọn Vắc xin dự kiến
    const ddlVaccineStr = FALLBACK_CHECKIN_LOCATORS['ddl_vaccine_select'];
    if (ddlVaccineStr) {
      await page.locator(ddlVaccineStr).click();
      await page.locator('role=option').first().click();
    }

    // 9. Chọn Phòng tiếp đón
    const ddlRoomStr = FALLBACK_CHECKIN_LOCATORS['ddl_room_select'];
    if (ddlRoomStr) {
      await page.locator(ddlRoomStr).click();
      await page.locator('role=option').first().click();
    }

    // 10. Click Lưu tiếp đón
    const btnSubmitStr = FALLBACK_CHECKIN_LOCATORS['btn_submit_checkin'];
    if (btnSubmitStr) {
      await page.locator(btnSubmitStr).click();
    }

    // Đợi dialog đóng và hàng chờ xuất hiện
    await page.waitForTimeout(2000);
    console.log('✅ [Queue Recovery] Tiếp đón khách vãng lai mới thành công.');
  } catch (err: any) {
    console.error('❌ [Queue Recovery] Lỗi khi tự động tiếp đón khách vãng lai:', err.message);
  }
}

async function translateErrorMessage(page: any, rawMessage: string): Promise<string> {
  if (!rawMessage) return 'Unknown error';
  const isTimeout = rawMessage.includes('Timeout') || rawMessage.includes('timeout') || rawMessage.includes('waiting for');
  if (isTimeout) {
    const isNoData = await page.locator('text="Không có dữ liệu"').first().isVisible({ timeout: 1000 }).catch(() => false);
    const isNoQueue = await page.locator('text="Không có khách hàng nào trong danh sách chờ"').first().isVisible({ timeout: 1000 }).catch(() => false);
    if (isNoData || isNoQueue) {
      return '❌ [THẤT BẠI] Không có dữ liệu trên giao diện (Hàng đợi trống / Bảng trống)';
    }
  }
  return rawMessage;
}

// 1. Đọc tệp scenarios.json đồng bộ
// Ưu tiên đọc từ process.env.SCENARIOS_JSON_PATH (parallel mode) trước khi fallback sang active_run_info
const runInfoSuffix = process.env.RUN_ID_PREFIX ? `_${process.env.RUN_ID_PREFIX}` : '';
const activeRunInfoPath = path.join(path.resolve(__dirname, '../.run'), `active_run_info${runInfoSuffix}.json`);
let activeRunInfo: any = {};
if (fs.existsSync(activeRunInfoPath)) {
  try {
    activeRunInfo = JSON.parse(fs.readFileSync(activeRunInfoPath, 'utf-8'));
  } catch (e) {
    console.error('Lỗi đọc active_run_info.json:', e);
  }
}

const scenariosPath = process.env.SCENARIOS_JSON_PATH || activeRunInfo.scenariosJsonPath;
const resultExcelPath = process.env.RESULT_EXCEL_PATH || activeRunInfo.resultExcelPath;
const runId = process.env.RUN_ID || activeRunInfo.runId || `run_${Date.now()}`;

function logTestCaseStart(tcId: string, summary: string, progressInfo?: string, iterationInfo?: string) {
  const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
  console.log('\n' + '='.repeat(100));
  const progressStr = progressInfo ? ` [${progressInfo}]` : '';
  const iterStr = iterationInfo ? ` [${iterationInfo}]` : '';
  console.log(`${workerPrefix}\x1b[34m🎬 STARTING TEST CASE: ${tcId}${progressStr}${iterStr}\x1b[0m`);
  console.log(`${workerPrefix}\x1b[36m📝 Summary: ${summary}\x1b[0m`);
  console.log('='.repeat(100) + '\n');
}

function logTestCaseResult(tcId: string, status: 'PASSED' | 'FAILED', failedStep?: number) {
  const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
  console.log('\n' + '='.repeat(100));
  if (status === 'PASSED') {
    console.log(`${workerPrefix}\x1b[32m✅ RESULT: ${tcId} -> PASSED\x1b[0m`);
  } else {
    console.log(`${workerPrefix}\x1b[31m❌ RESULT: ${tcId} -> FAILED at step ${failedStep}\x1b[0m`);
  }
  console.log('='.repeat(100) + '\n');
}

if (!scenariosPath || !fs.existsSync(scenariosPath)) {
  console.warn(`⚠️ [TestEngine] Warning: Scenarios JSON not found at ${scenariosPath}. Skipping test definition.`);
}

const payload = scenariosPath && fs.existsSync(scenariosPath)
  ? JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'))
  : { pages: [], modules: [], allTestCases: {} };

const pages = payload.pages || [];
let modules = payload.modules || [];
const allTestCases = payload.allTestCases || {};
const preconditionTestCases = payload.preconditionTestCases || [];

// Support MAX_TEST_CASES environment variable to limit test execution (e.g., run only first 10)
const maxTestCases = process.env.MAX_TEST_CASES ? parseInt(process.env.MAX_TEST_CASES, 10) : undefined;
if (maxTestCases && maxTestCases > 0) {
  let totalTestCount = 0;
  modules = modules.map((mod: any) => {
    const remainingSlots = maxTestCases - totalTestCount;
    if (remainingSlots <= 0) {
      return { ...mod, testCases: [] }; // Skip this module
    }
    const limitedTestCases = mod.testCases.slice(0, remainingSlots);
    totalTestCount += limitedTestCases.length;
    return { ...mod, testCases: limitedTestCases };
  }).filter((mod: any) => mod.testCases.length > 0);
  console.log(`\n🔒 [Config] MAX_TEST_CASES=${maxTestCases} - Chạy chỉ ${totalTestCount} test case đầu tiên\n`);
}

// Xác định thông tin đăng nhập Basic Auth cho môi trường local
const currentEnv = appConfig.currentEnv;
const httpCredentials = currentEnv === 'local' ? {
  username: appConfig.credentials.LOCAL_HTTP_USER,
  password: appConfig.credentials.LOCAL_HTTP_PASS
} : undefined;

const readerForRun = resultExcelPath ? new ExcelReader(resultExcelPath) : null;
const writer = resultExcelPath ? new ResultWriter(resultExcelPath) : null;
const originalExcelPath = activeRunInfo.originalExcelPath;
const originalWriter = (originalExcelPath && process.env.DISABLE_ORIGINAL_EXCEL_WRITE !== 'true') ? new ResultWriter(originalExcelPath) : null;

// Helper để ghi status SKIP cho các bước còn lại khi xảy ra lỗi FAILED
async function skipRemainingSteps(
  steps: any[],
  failedStepIndex: number,
  moduleName: string,
  tcId: string,
  iterationInfo?: any
) {
  if (!writer) return;
  for (let i = failedStepIndex + 1; i < steps.length; i++) {
    const skipStep = steps[i];
    await writer.updateStepResult(moduleName, tcId, skipStep.step, {
      status: 'SKIP',
      observed: '',
      expected: '',
      action: skipStep.action,
      iterationInfo
    });
    if (originalWriter) {
      try {
        await originalWriter.updateStepResult(moduleName, tcId, skipStep.step, {
          status: 'SKIP',
          observed: '',
          action: skipStep.action,
          iterationInfo
        }, { silent: true });
      } catch (e: any) {
        console.error(`⚠️ [TestEngine] Warning: Không thể ghi kết quả SKIP vào file Excel gốc:`, e.message);
      }
    }
  }
}

// ── Unified Step Result Writer ─────────────────────────────────
// Ghi kết quả vào cả writer (run copy) và originalWriter (file gốc)
// Tránh duplicate logic 4 nhánh x 2 blocks (PASSED/FAILED) x 2 writers

async function writeStepResult(
  moduleName: string,
  tcId: string,
  stepNum: number,
  result: {
    status: 'PASSED' | 'FAILED' | 'TBD' | 'SKIP';
    observed: string;
    expected?: string;
    screenshot?: string;
    duration: number;
    action: string;
    iterationInfo?: any;
  }
) {
  if (!writer) return;
  await writer.updateStepResult(moduleName, tcId, stepNum, result);
  if (originalWriter) {
    try {
      await originalWriter.updateStepResult(moduleName, tcId, stepNum, result, { silent: true });
    } catch (e: any) {
      console.error(`⚠️ [TestEngine] Warning: Không thể ghi kết quả vào file Excel gốc:`, e.message);
    }
  }
}

// ── Unified Test Steps Runner ──────────────────────────────────
// Thực thi tất cả steps của 1 test case và ghi kết quả
// Return: { passed: boolean, failedStep?: number, failureReason?: string }

interface RunStepsOptions {
  page: any;
  tc: any;
  moduleName: string;
  contextData: Record<string, any>;
  locatorResolver: any;
  dataResolver: any;
  progressInfo: string;
  iterationInfo?: any;
  onNavigated?: (url: string) => void;
  translateError?: boolean;
}

async function runTestSteps(opts: RunStepsOptions): Promise<{ passed: boolean; failedStep?: number; failureReason?: string }> {
  const { page, tc, moduleName, contextData, locatorResolver, dataResolver, progressInfo, iterationInfo, onNavigated, translateError } = opts;

  if (!readerForRun || !writer) {
    throw new Error(`❌ [TestEngine] Core Engine (Reader/Writer) not initialized properly.`);
  }

  const actionExecutor = new ActionExecutor(page, locatorResolver, dataResolver, readerForRun, pages);
  logTestCaseStart(tc.tc_id, tc.summary, progressInfo, iterationInfo ? `Iteration ${iterationInfo.index} (${iterationInfo.type})` : undefined);

  for (let i = 0; i < tc.steps.length; i++) {
    const step = tc.steps[i];
    const startTime = Date.now();
    const stepResult = await actionExecutor.executeStep(step, contextData, tc.tc_id);
    const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    // Ghi nhận URL khi navigate thành công
    if (stepResult.status === 'PASSED' && step.action.toLowerCase() === 'navigate' && onNavigated) {
      try { onNavigated(page.url()); } catch { /* ignore */ }
    }

    if (stepResult.status === 'FAILED') {
      const absoluteScreenshotPath = stepResult.screenshotPath
        ? path.resolve(activeRunInfo.runReportDir, stepResult.screenshotPath)
        : undefined;

      const observedValue = translateError
        ? await translateErrorMessage(page, stepResult.observed || '')
        : stepResult.observed;

      await writeStepResult(moduleName, tc.tc_id, step.step, {
        status: 'FAILED',
        observed: observedValue,
        expected: stepResult.expected,
        screenshot: absoluteScreenshotPath,
        duration,
        action: step.action,
        iterationInfo
      });

      await skipRemainingSteps(tc.steps, i, moduleName, tc.tc_id, iterationInfo);
      logTestCaseResult(tc.tc_id, 'FAILED', step.step);

      return { passed: false, failedStep: step.step, failureReason: observedValue };
    } else {
      const isCheckStatus = step.action.toLowerCase() === 'check_status' || step.action.toLowerCase() === 'check_value';
      const absoluteScreenshotPath = (stepResult.screenshotPath && isCheckStatus)
        ? path.resolve(activeRunInfo.runReportDir, stepResult.screenshotPath)
        : undefined;
      const observedValue = isCheckStatus ? stepResult.observed : '';

      await writeStepResult(moduleName, tc.tc_id, step.step, {
        status: stepResult.status,
        observed: observedValue,
        expected: stepResult.expected,
        screenshot: absoluteScreenshotPath,
        duration,
        action: step.action,
        iterationInfo
      });
    }
  }

  logTestCaseResult(tc.tc_id, 'PASSED');
  return { passed: true };
}


async function executePrecondition(
  page: any,
  preconditionId: string,
  locatorResolver: any,
  dataResolver: any,
  readerForRun: any,
  pages: any,
  runId: string
) {
  if (!preconditionId) return;

  // Hỗ trợ nhiều precondition phân tách bằng dấu phẩy và xuống dòng
  const preIds = preconditionId.split(/[\n,]+/).map(id => id.trim()).filter(id => id);
  if (preIds.length > 1) {
    for (const preId of preIds) {
      await executePrecondition(page, preId, locatorResolver, dataResolver, readerForRun, pages, runId);
    }
    return;
  }

  const currentPreId = preIds[0];
  console.log(`🚀 [Precondition] Running: [${currentPreId}]...`);

  // ⚡ Fast-path: Nếu storageState đã lưu và là kịch bản login super admin, thử navigate thẳng
  if (currentPreId === 'pre_super_admin_login_success' && fs.existsSync(STORAGE_STATE_PATH)) {
    let currentUrl = page.url();
    if (currentUrl === 'about:blank') {
      const tcPage = pages.find((p: any) => p.page_key === 'tiem_chung_dashboard' || p.page_key === 'ds_cho_tiem');
      const targetUrl = tcPage ? tcPage.url : '/vaccination';
      console.log(`⚡ [Precondition Bypass] Thử navigate đến app để check session cũ: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      currentUrl = page.url();
    }
    const isStillLogin = isLoginPage(currentUrl, pages);
    if (!isStillLogin) {
      console.log(`✨ [Precondition Bypass] storageState hợp lệ, đã đăng nhập sẵn (${currentUrl}). Bỏ qua login flow.`);
      return;
    }
  }

  const preTc = preconditionTestCases.find((tc: any) => tc.tc_id === currentPreId);
  if (!preTc) {
    throw new Error(`❌ [Precondition] Error: Không tìm thấy kịch bản tiền đề [${currentPreId}]`);
  }

  // Ghi đè locator các phần tử login trên local để khớp với giao diện thực tế
  if (currentEnv === 'local') {
    const elementsMap = (locatorResolver as any).elementsMap;
    if (elementsMap) {
      elementsMap.set('txt_username', {
        element_id: 'txt_username',
        locator_type: 'id',
        locator_value: 'email'
      });
      elementsMap.set('txt_password', {
        element_id: 'txt_password',
        locator_type: 'id',
        locator_value: 'password'
      });
      elementsMap.set('btn_login', {
        element_id: 'btn_login',
        locator_type: 'css',
        locator_value: 'button:has-text("Đăng nhập với SSO")'
      });
      console.log('🔧 [Precondition Local Config] Đã tự động ghi đè locator các phần tử login cho môi trường local (txt_username -> id=email, btn_login -> Đăng nhập với SSO).');
    }
  }

  const contextData = { __runId: runId };

  const actionExecutor = new ActionExecutor(page, locatorResolver, dataResolver, readerForRun || new ExcelReader(''), pages);
  for (const step of preTc.steps) {
    // Kiểm tra bypass login trên local nếu đã ở trạng thái đăng nhập sẵn (redirect về dashboard)
    if (currentEnv === 'local' && (step.target === 'txt_username' || step.target === 'txt_password' || step.target === 'btn_login')) {
      const currentUrl = page.url();
      const usernameLocatorStr = locatorResolver.resolve('txt_username', '');
      const isUsernameVisible = usernameLocatorStr ? await page.locator(usernameLocatorStr).isVisible({ timeout: 1000 }).catch(() => false) : false;

      if (!isUsernameVisible && !isLoginPage(currentUrl, pages)) {
        console.log(`✨ [Precondition Bypass] Môi trường local tự động đăng nhập (đang ở ${currentUrl}). Bỏ qua các bước nhập login còn lại.`);
        break; // Coi như hoàn thành precondition thành công
      }
    }

    // Tự động bỏ qua các bước click nếu không thấy phần tử hiển thị (để tránh login timeout)
    if (step.action.toLowerCase() === 'click') {
      if (step.target === 'btn_keycloak_sso' || step.target === 'btn_dynamic_select') {
        const resolvedVal = dataResolver.resolve(step.value, contextData);
        const locatorString = locatorResolver.resolve(step.target, resolvedVal);
        const isVisible = locatorString ? await page.locator(locatorString).waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false) : false;
        if (!isVisible) {
          console.log(`⚠️ [Precondition Skip] Không tìm thấy phần tử ${step.target} trên giao diện. Tự động bỏ qua bước click này.`);
          continue; // Bỏ qua step này và chạy tiếp step sau
        }
      }
    }

    const stepResult = await actionExecutor.executeStep(step, contextData, preTc.tc_id);
    if (stepResult.status === 'FAILED') {
      throw new Error(`❌ [Precondition] FAILED at step ${step.step}: ${stepResult.observed}`);
    }
  }

  // Tự động cập nhật lưu storageState mới nhất sau khi login thành công bằng precondition
  if (currentPreId === 'pre_super_admin_login_success') {
    await page.context().storageState({ path: STORAGE_STATE_PATH }).catch((err: any) => {
      console.warn(`⚠️ [Precondition] Không thể lưu lại storageState mới:`, err.message);
    });
    console.log(`✨ [Precondition] Đã lưu session mới nhất vào: ${STORAGE_STATE_PATH}`);
  }

  console.log(`✅ [Precondition] Completed: [${preconditionId}]`);
}

// Helper tự động nhân bản chéo dữ liệu chạy test (Cartesian Product) cho các cột cấu hình
function expandTestData(testData: any[], allTestData: any[]): any[] {
  const crossColumns = appConfig.crossIterationColumns;

  let result = [...testData];

  for (const col of crossColumns) {
    // Lấy tất cả các giá trị duy nhất, không rỗng của cột này trong sheet DATA
    const uniqueValues = [...new Set(allTestData.map((d: any) => d[col]).filter((val: any) => val && String(val).trim() !== ''))];

    if (uniqueValues.length > 0) {
      const expanded: any[] = [];
      result.forEach((dataRow: any) => {
        uniqueValues.forEach((val: any) => {
          expanded.push({
            ...dataRow,
            [col]: val
          });
        });
      });
      result = expanded;
    }
  }

  return result;
}

// 2. Định nghĩa các khối test() động dựa trên JSON kịch bản
const loginData = payload.loginData || [];
const validLoginData = loginData.filter((d: any) => d.test_case_type.toLowerCase() === 'pos');

for (const mod of modules) {
  // Lọc theo MODULE_FILTER của command line nếu có
  const moduleFilter = process.env.MODULE_FILTER;
  if (moduleFilter && moduleFilter.toLowerCase() !== mod.moduleName.toLowerCase()) {
    continue;
  }

  const loginElements = payload.loginElements || [];
  const allElements = [
    ...loginElements,
    ...modules.flatMap((m: any) => m.elements || [])
  ];
  const locatorResolver = new LocatorResolver(allElements);
  const dataResolver = new DataResolver();
  const pagesMap = new Map<string, string>(pages.map((p: any) => [p.page_key, p.url]));

  if (mod.moduleName.toLowerCase() === 'login') {
    // === XỬ LÝ RIÊNG CHO MODULE LOGIN: Close browser sau mỗi test case ===
    test.describe(`Module: ${mod.moduleName.toUpperCase()}`, () => {
      let localContext: any;
      let localPage: any;

      test.beforeEach(async ({ browser }) => {
        localContext = await browser.newContext({
          ...(httpCredentials ? { httpCredentials } : {}),
          ...storageStateOption
        });
        localPage = await localContext.newPage();
      });

      test.afterEach(async () => {
        if (localPage) {
          try {
            await localPage.close();
          } catch (e) { }
        }
        if (localContext) {
          try {
            await localContext.close();
          } catch (e) { }
        }
      });

      for (let tcIndex = 0; tcIndex < mod.testCases.length; tcIndex++) {
        const tc = mod.testCases[tcIndex];
        const progressInfo = `${tcIndex + 1}/${mod.testCases.length}`;
        const matchingData = mod.testData.filter((d: any) => {
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
        const finalMatchingData = expandTestData(matchingData, mod.testData);

        if (tc.parameterized === 'Y' && finalMatchingData.length > 0) {
          // Chạy Data-Driven
          finalMatchingData.forEach((dataRow: any, index: number) => {
            const iterationName = `Iteration ${index + 1} (${dataRow.test_case_type})`;
            const testTitle = `${tc.tc_id} - ${tc.summary} [${iterationName}]`;
            const iterInfo = { index: index + 1, total: finalMatchingData.length, type: dataRow.test_case_type };

            test(testTitle, async () => {
              const result = await runTestSteps({
                page: localPage, tc, moduleName: mod.moduleName,
                contextData: { ...dataRow, __runId: runId },
                locatorResolver, dataResolver, progressInfo,
                iterationInfo: iterInfo
              });
              if (!result.passed) throw new Error(`Step ${result.failedStep} FAILED: ${result.failureReason}`);
            });
          });
        } else {
          // Chạy Single Run
          const testTitle = `${tc.tc_id} - ${tc.summary}`;
          test(testTitle, async () => {
            const defaultData = finalMatchingData.length > 0 ? finalMatchingData[0] : {};
            const result = await runTestSteps({
              page: localPage, tc, moduleName: mod.moduleName,
              contextData: { ...defaultData, __runId: runId },
              locatorResolver, dataResolver, progressInfo
            });
            if (!result.passed) throw new Error(`Step ${result.failedStep} FAILED: ${result.failureReason}`);
          });
        }
      }
    });
  } else {
    // === XỬ LÝ CHO CÁC MODULE NGHIỆP VỤ KHÁC ===
    test.describe(`Module: ${mod.moduleName.toUpperCase()}`, () => {
      let sharedPage: any;
      let lastNavigatedUrl = '';
      let lastRunPrecondition = '';
      let moduleDefaultUrl = '';

      test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({
          ...(httpCredentials ? { httpCredentials } : {}),
          ...storageStateOption
        });
        sharedPage = await context.newPage();

        // Tự động quét tìm URL navigate đầu tiên của module
        for (const t of mod.testCases) {
          const navStep = t.steps.find((s: any) => s.action.toLowerCase() === 'navigate');
          if (navStep && navStep.target) {
            moduleDefaultUrl = pagesMap.get(navStep.target) || (navStep.target.startsWith('http') ? navStep.target : '');
            if (moduleDefaultUrl) {
              console.log(`[TestEngine] Detected module default URL: ${moduleDefaultUrl}`);
              break;
            }
          }
        }
      });

      test.afterAll(async () => {
        if (sharedPage) {
          try {
            await sharedPage.close();
          } catch (e) { }
        }
      });

      for (let tcIndex = 0; tcIndex < mod.testCases.length; tcIndex++) {
        const tc = mod.testCases[tcIndex];
        const progressInfo = `${tcIndex + 1}/${mod.testCases.length}`;
        const matchingData = mod.testData.filter((d: any) => {
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
        const finalMatchingData = expandTestData(matchingData, mod.testData);

        if (tc.parameterized === 'Y' && finalMatchingData.length > 0) {
          // Chạy Data-Driven
          finalMatchingData.forEach((dataRow: any, index: number) => {
            const iterationName = `Iteration ${index + 1} (${dataRow.test_case_type})`;
            const testTitle = `${tc.tc_id} - ${tc.summary} [${iterationName}]`;

            test(testTitle, async () => {
              if (!readerForRun || !writer) {
                throw new Error(`❌ [TestEngine] Core Engine (Reader/Writer) not initialized properly.`);
              }

              // ⚡ Smart Recovery: Nếu storageState đã lưu và browser về blank/login,
              //    navigate thẳng đến target URL — browser tự xác thực bằng cookies.
              const currentUrl = sharedPage.url();
              const activePrecondition = tc.precondition || lastRunPrecondition || 'pre_super_admin_login_success';

              // Nếu đổi vai trò (precondition thay đổi so với lần chạy trước), hoặc browser đang ở blank/login
              const isRoleChanged = lastRunPrecondition && lastRunPrecondition !== activePrecondition;
              const needsPrecondition = isLoginPage(currentUrl, pages) || isRoleChanged;

              // Chỉ sử dụng storageState dùng chung đối với vai trò Super Admin mặc định
              const hasStorageState = fs.existsSync(STORAGE_STATE_PATH) && activePrecondition === 'pre_super_admin_login_success';

              if (isRoleChanged) {
                console.log(`🔄 [Role Change Detected] Chuyển đổi kịch bản từ [${lastRunPrecondition}] sang [${activePrecondition}]. Đang làm sạch session cũ...`);
                await sharedPage.context().clearCookies();
                await sharedPage.evaluate(() => {
                  localStorage.clear();
                  sessionStorage.clear();
                }).catch(() => { });
                await sharedPage.goto('about:blank');
              }

              if (needsPrecondition) {
                const targetUrl = lastNavigatedUrl || moduleDefaultUrl;

                if (hasStorageState && targetUrl) {
                  // Thử navigate trực tiếp → cookies sẽ tự xác thực
                  console.log(`⚡ [StorageState Recovery] Navigate thẳng đến ${targetUrl} (bỏ qua login)...`);
                  await sharedPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
                  await sharedPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { });
                  const urlAfterNav = sharedPage.url();

                  if (!isLoginPage(urlAfterNav, pages)) {
                    // Xác thực thành công nhờ cookies
                    console.log(`✅ [StorageState Recovery] Đã vào được app (${urlAfterNav}).`);
                    lastNavigatedUrl = urlAfterNav;
                    lastRunPrecondition = activePrecondition;
                  } else {
                    // Cookies hết hạn → fallback login bình thường
                    console.log(`🔄 [Engine Recovery] Cookies hết hạn. Re-running precondition: ${activePrecondition}...`);
                    await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                    lastRunPrecondition = activePrecondition;
                    if (targetUrl) {
                      await sharedPage.goto(targetUrl);
                      lastNavigatedUrl = targetUrl;
                    }
                  }
                } else {
                  // Không có storageState hoặc role khác admin → login bình thường
                  console.log(`🔄 [Engine Recovery] Re-running precondition: ${activePrecondition}...`);
                  await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                  lastRunPrecondition = activePrecondition;
                  if (targetUrl) {
                    console.log(`🔄 [Engine Recovery] Navigating to target page: ${targetUrl}`);
                    await sharedPage.goto(targetUrl);
                    lastNavigatedUrl = targetUrl;
                  }
                }
              } else {
                const targetUrl = lastNavigatedUrl || moduleDefaultUrl;
                if (targetUrl) {
                  const currentUrl = sharedPage.url();
                  let isSamePage = false;
                  try {
                    const currentPath = new URL(currentUrl).pathname;
                    const targetPath = targetUrl.startsWith('http') ? new URL(targetUrl).pathname : targetUrl;
                    isSamePage = currentPath === targetPath || currentPath.endsWith(targetPath) || targetPath.endsWith(currentPath);
                  } catch (e) {
                    isSamePage = currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl);
                  }

                  let shouldBypass = false;
                  if (isSamePage) {
                    const isRoomSelected = await sharedPage.locator('[data-testid="vaccination-session-toolbar-room-select"]').isVisible().catch(() => false);
                    const isPromptVisible = await sharedPage.locator('text="Vui lòng chọn phòng tiêm"').isVisible().catch(() => false)
                      || await sharedPage.locator('text="Vui lòng chọn phòng để xem danh sách khách hàng."').isVisible().catch(() => false);
                    if (isRoomSelected && !isPromptVisible) {
                      shouldBypass = true;
                    }
                  }

                  if (shouldBypass) {
                    console.log(`   ⚡ [Auto-refresh Bypass] Đang ở đúng trang và phòng trực đã chọn sẵn. Bỏ qua refresh.`);
                  } else {
                    console.log(`🔄 [Auto-refresh] Navigating to: ${targetUrl}`);
                    await sharedPage.goto(targetUrl);
                    lastNavigatedUrl = targetUrl;

                    // Kiểm tra xem có bị redirect về trang login không
                    const urlAfterNav = sharedPage.url();
                    if (isLoginPage(urlAfterNav, pages)) {
                      console.log(`🔄 [Auto-refresh Recovery] Bị redirect về login. Re-running precondition: ${activePrecondition}...`);
                      await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                      lastRunPrecondition = activePrecondition;
                      await sharedPage.goto(targetUrl);
                      lastNavigatedUrl = targetUrl;
                    }
                  }
                }
              }

              const contextData = { ...dataRow, __runId: runId };

              if ((mod.moduleName.toLowerCase() === 'danh_gia_ban_dau' || mod.moduleName.toLowerCase() === 'kham_sang_loc') && tc.steps.some((s: any) => s.target === 'first_row')) {
                await ensureQueueNotEmpty(sharedPage, locatorResolver, contextData, dataResolver);
              }

              const iterInfo = { index: index + 1, total: finalMatchingData.length, type: dataRow.test_case_type };
              const result = await runTestSteps({
                page: sharedPage, tc, moduleName: mod.moduleName,
                contextData, locatorResolver, dataResolver, progressInfo,
                iterationInfo: iterInfo,
                onNavigated: (url) => { lastNavigatedUrl = url; },
                translateError: true
              });
              if (!result.passed) {
                throw new Error(`Test case ${tc.tc_id} failed at step ${result.failedStep}: ${result.failureReason}`);
              }
            });
          });
        } else {
          // Chạy Single Run
          const testTitle = `${tc.tc_id} - ${tc.summary}`;

          test(testTitle, async () => {
            if (!readerForRun || !writer) {
              throw new Error(`❌ [TestEngine] Core Engine (Reader/Writer) not initialized properly.`);
            }

            // ⚡ Smart Recovery: Nếu storageState đã lưu và browser về blank/login,
            //    navigate thẳng đến target URL — browser tự xác thực bằng cookies.
            const currentUrl = sharedPage.url();
            const activePrecondition = tc.precondition || lastRunPrecondition || 'pre_super_admin_login_success';

            // Nếu đổi vai trò (precondition thay đổi so với lần chạy trước), hoặc browser đang ở blank/login
            const isRoleChanged = lastRunPrecondition && lastRunPrecondition !== activePrecondition;
            const needsPrecondition = isLoginPage(currentUrl, pages) || isRoleChanged;

            // Chỉ sử dụng storageState dùng chung đối với vai trò Super Admin mặc định
            const hasStorageState = fs.existsSync(STORAGE_STATE_PATH) && activePrecondition === 'pre_super_admin_login_success';

            if (isRoleChanged) {
              console.log(`🔄 [Role Change Detected] Chuyển đổi kịch bản từ [${lastRunPrecondition}] sang [${activePrecondition}]. Đang làm sạch session cũ...`);
              await sharedPage.context().clearCookies();
              await sharedPage.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
              }).catch(() => { });
              await sharedPage.goto('about:blank');
            }

            if (needsPrecondition) {
              const targetUrl = lastNavigatedUrl || moduleDefaultUrl;

              if (hasStorageState && targetUrl) {
                console.log(`⚡ [StorageState Recovery] Navigate thẳng đến ${targetUrl} (bỏ qua login)...`);
                await sharedPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
                await sharedPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { });
                const urlAfterNav = sharedPage.url();

                if (!isLoginPage(urlAfterNav, pages)) {
                  console.log(`✅ [StorageState Recovery] Đã vào được app (${urlAfterNav}).`);
                  lastNavigatedUrl = urlAfterNav;
                  lastRunPrecondition = activePrecondition;
                } else {
                  console.log(`🔄 [Engine Recovery] Cookies hết hạn. Re-running precondition: ${activePrecondition}...`);
                  await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                  lastRunPrecondition = activePrecondition;
                  if (targetUrl) {
                    await sharedPage.goto(targetUrl);
                    lastNavigatedUrl = targetUrl;
                  }
                }
              } else {
                // Không có storageState hoặc role khác admin → login bình thường
                console.log(`🔄 [Engine Recovery] Re-running precondition: ${activePrecondition}...`);
                await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                lastRunPrecondition = activePrecondition;
                if (targetUrl) {
                  console.log(`🔄 [Engine Recovery] Navigating to target page: ${targetUrl}`);
                  await sharedPage.goto(targetUrl);
                  lastNavigatedUrl = targetUrl;
                }
              }
            } else {
              const targetUrl = lastNavigatedUrl || moduleDefaultUrl;
              if (targetUrl) {
                const currentUrl = sharedPage.url();
                let isSamePage = false;
                try {
                  const currentPath = new URL(currentUrl).pathname;
                  const targetPath = targetUrl.startsWith('http') ? new URL(targetUrl).pathname : targetUrl;
                  isSamePage = currentPath === targetPath || currentPath.endsWith(targetPath) || targetPath.endsWith(currentPath);
                } catch (e) {
                  isSamePage = currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl);
                }

                let shouldBypass = false;
                if (isSamePage) {
                  const isRoomSelected = await sharedPage.locator('[data-testid="vaccination-session-toolbar-room-select"]').isVisible().catch(() => false);
                  const isPromptVisible = await sharedPage.locator('text="Vui lòng chọn phòng tiêm"').isVisible().catch(() => false)
                    || await sharedPage.locator('text="Vui lòng chọn phòng để xem danh sách khách hàng."').isVisible().catch(() => false);
                  if (isRoomSelected && !isPromptVisible) {
                    shouldBypass = true;
                  }
                }

                if (shouldBypass) {
                  console.log(`   ⚡ [Auto-refresh Bypass] Đang ở đúng trang và phòng trực đã chọn sẵn. Bỏ qua refresh.`);
                } else {
                  console.log(`🔄 [Auto-refresh] Navigating to: ${targetUrl}`);
                  await sharedPage.goto(targetUrl);
                  lastNavigatedUrl = targetUrl;

                  // Kiểm tra xem có bị redirect về trang login không
                  const urlAfterNav = sharedPage.url();
                  if (isLoginPage(urlAfterNav, pages)) {
                    console.log(`🔄 [Auto-refresh Recovery] Bị redirect về login. Re-running precondition: ${activePrecondition}...`);
                    await executePrecondition(sharedPage, activePrecondition, locatorResolver, dataResolver, readerForRun, pages, runId);
                    lastRunPrecondition = activePrecondition;
                    await sharedPage.goto(targetUrl);
                    lastNavigatedUrl = targetUrl;
                  }
                }
              }
            }

            const actionExecutor = new ActionExecutor(sharedPage, locatorResolver, dataResolver, readerForRun, pages);
            const defaultData = finalMatchingData.length > 0 ? finalMatchingData[0] : {};
            const contextData = { ...defaultData, __runId: runId };

            if ((mod.moduleName.toLowerCase() === 'danh_gia_ban_dau' || mod.moduleName.toLowerCase() === 'kham_sang_loc') && tc.steps.some((s: any) => s.target === 'first_row')) {
              await ensureQueueNotEmpty(sharedPage, locatorResolver, contextData, dataResolver);
            }

            const result = await runTestSteps({
              page: sharedPage, tc, moduleName: mod.moduleName,
              contextData, locatorResolver, dataResolver, progressInfo,
              onNavigated: (url) => { lastNavigatedUrl = url; },
              translateError: true
            });
            if (!result.passed) {
              throw new Error(`Test case ${tc.tc_id} failed at step ${result.failedStep}: ${result.failureReason}`);
            }
          });
        }
      }
    });
  }
}
