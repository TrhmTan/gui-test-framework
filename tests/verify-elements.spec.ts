import { test } from '@playwright/test';
import { ExcelReader } from '../src/core/ExcelReader';
import { LocatorResolver } from '../src/core/LocatorResolver';
import { ActionExecutor } from '../src/core/ActionExecutor';
import { DataResolver } from '../src/core/DataResolver';
import { ResultWriter } from '../src/core/ResultWriter';
import { appConfig } from '../src/core/ConfigLoader';
import * as fs from 'fs';
import * as path from 'path';

// 1. Đọc tệp scenarios.json đồng bộ
// Hỗ trợ parallel mode: đọc file riêng theo RUN_ID_PREFIX
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
const currentEnv = appConfig.currentEnv;

if (!scenariosPath || !fs.existsSync(scenariosPath)) {
  console.warn(`[ElementVerifier] Warning: Scenarios JSON not found at ${scenariosPath}. Skipping test definition.`);
}

const payload = scenariosPath && fs.existsSync(scenariosPath)
  ? JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'))
  : { pages: [], modules: [], allTestCases: {} };

const pages = payload.pages || [];
const modules = payload.modules || [];
const allTestCases = payload.allTestCases || {};
const preconditionTestCases = payload.preconditionTestCases || [];

const readerForRun = resultExcelPath ? new ExcelReader(resultExcelPath) : null;
const writer = resultExcelPath ? new ResultWriter(resultExcelPath) : null;

// Helper thực thi kịch bản precondition động
async function executePrecondition(
  page: any,
  preconditionId: string,
  locatorResolver: any,
  dataResolver: any,
  readerForRun: any,
  pages: any
): Promise<void> {
  if (!preconditionId) return;

  // Hỗ trợ nhiều precondition phân tách bằng dấu phẩy và xuống dòng
  const preIds = preconditionId.split(/[\n,]+/).map(id => id.trim()).filter(id => id);
  if (preIds.length > 1) {
    for (const preId of preIds) {
      await executePrecondition(page, preId, locatorResolver, dataResolver, readerForRun, pages);
    }
    return;
  }

  const currentPreId = preIds[0];
  console.log(`[ElementVerifier] Đang thực thi kịch bản tiền đề: [${currentPreId}]...`);
  
  const preTc = preconditionTestCases.find((tc: any) => tc.tc_id === currentPreId);
  if (!preTc) {
    throw new Error(`[ElementVerifier] Lỗi: Không tìm thấy kịch bản tiền đề [${currentPreId}] trong PRECONDITION.`);
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

  const contextData = {};
  
  const actionExecutor = new ActionExecutor(page, locatorResolver, dataResolver, readerForRun || new ExcelReader(''), pages);
  for (const step of preTc.steps) {
    // Tự động bỏ qua các bước click nếu không thấy phần tử hiển thị trên môi trường local
    if (currentEnv === 'local' && step.action.toLowerCase() === 'click') {
      if (step.target === 'btn_keycloak_sso' || step.target === 'btn_dynamic_select') {
        const resolvedVal = dataResolver.resolve(step.value, contextData);
        const locatorString = locatorResolver.resolve(step.target, resolvedVal);
        const isVisible = locatorString ? await page.locator(locatorString).isVisible({ timeout: 1500 }).catch(() => false) : false;
        if (!isVisible) {
          console.log(`⚠️ [Precondition Skip] Môi trường local: Không tìm thấy phần tử ${step.target} trên giao diện. Tự động bỏ qua bước click này.`);
          continue; // Bỏ qua step này và chạy tiếp step sau
        }
      }
    }

    const stepResult = await actionExecutor.executeStep(step, contextData, preTc.tc_id);
    if (stepResult.status === 'FAILED') {
      throw new Error(`[ElementVerifier] Chạy kịch bản tiền đề [${currentPreId}] THẤT BẠI: ${stepResult.observed}`);
    }
  }
  console.log(`[ElementVerifier] Đã thực thi xong kịch bản tiền đề: [${currentPreId}]`);
}

// 2. Định nghĩa khối test quét elements động
for (const mod of modules) {
  // Lọc theo MODULE_FILTER của command line nếu có
  const moduleFilter = process.env.MODULE_FILTER;
  if (moduleFilter && moduleFilter.toLowerCase() !== mod.moduleName.toLowerCase()) {
    continue;
  }

  test.describe(`Verify Elements: ${mod.moduleName.toUpperCase()}`, () => {
    test(`Verify all elements in ELEMENT_${mod.moduleName.toUpperCase()}`, async ({ page }) => {
      const loginElements = payload.loginElements || [];
      const allElements = [
        ...loginElements,
        ...modules.flatMap((m: any) => m.elements || [])
      ];
      const locatorResolver = new LocatorResolver(allElements);
      const dataResolver = new DataResolver();
      
      const actionExecutor = new ActionExecutor(
        page,
        locatorResolver,
        dataResolver,
        readerForRun || new ExcelReader(''),
        pages
      );

      console.log(`[ElementVerifier] Thiết lập tiền đề cho module: ${mod.moduleName}`);

      // Tìm test case đầu tiên để lấy các bước tiền đề (như precondition, navigate)
      const firstTc = mod.testCases[0];
      if (firstTc) {
        // 1. Chạy precondition nếu có định nghĩa
        if (firstTc.precondition) {
          try {
            await executePrecondition(page, firstTc.precondition, locatorResolver, dataResolver, readerForRun, pages);
          } catch (e: any) {
            console.error(`[ElementVerifier] Lỗi khi thực hiện tiền đề: ${e.message}`);
          }
        }
        
        // 2. Chạy bước navigate nếu bước 1 của test case là navigate
        for (const step of firstTc.steps) {
          const actionLower = step.action.toLowerCase();
          if (actionLower === 'navigate') {
            console.log(`[ElementVerifier] Chạy bước điều hướng: ${step.action} | target: ${step.target}`);
            const defaultData = mod.testData.length > 0 ? mod.testData[0] : {};
            const result = await actionExecutor.executeStep(step, defaultData, firstTc.tc_id);
            if (result.status === 'FAILED') {
              console.error(`[ElementVerifier] Lỗi khi thực hiện điều hướng [${step.action}]: ${result.observed}`);
            }
          }
        }
      }

      // Đợi trang load hoàn toàn
      await page.waitForTimeout(3000);

      // Nếu là các module cụ thể, tự động mở Form để quét các phần tử bên trong
      if (mod.moduleName.toLowerCase() === 'danh_gia_ban_dau') {
        console.log(`[ElementVerifier] Tự động mở Form Tiếp nhận & Đo chỉ số sinh tồn...`);
        const statusBtn = page.locator('text=Chờ đo chỉ số sinh tồn').first();
        if (await statusBtn.count() > 0) {
          await statusBtn.click();
          await page.waitForTimeout(3000); // Chờ Form hiển thị
        }
      } else if (mod.moduleName.toLowerCase() === 'khach_vang_lai') {
        console.log(`[ElementVerifier] Tự động mở Form Tiếp đón khách vãng lai...`);
        const openBtn = page.locator(`//button[contains(text(), 'Tiếp đón khách vãng lai')]`).first();
        if (await openBtn.count() > 0) {
          await openBtn.click();
          await page.waitForTimeout(3000); // Chờ Form hiển thị
        }
      } else if (mod.moduleName.toLowerCase() === 'danh_sach_cho_tiem') {
        console.log(`[ElementVerifier] Tự động mở Form Bảng kiểm theo dõi sau tiêm...`);
        const recordBtn = page.locator('button[data-testid^="monitor-record-ses-"]').first();
        if (await recordBtn.count() > 0) {
          await recordBtn.click();
          await page.waitForTimeout(3000); // Chờ Form hiển thị
        }
      } else if (mod.moduleName.toLowerCase() === 'dieu_phoi') {
        console.log(`[ElementVerifier] Tự động chọn khách hàng đầu tiên để hiển thị panel chuyển phòng...`);
        const firstRow = page.locator('div.flex-1.overflow-y-auto > div >> nth=0').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(3000); // Chờ panel hiển thị
        }
      }

      let passCount = 0;
      let failCount = 0;

      const verifyElement = async (elConfig: any) => {
        const elementId = elConfig.element_id;
        if (!elementId || elementId.startsWith('---') || elementId.includes('MÀN HÌNH') || elementId.includes('TRANG')) {
          console.log(`[Bỏ qua dòng phân cách] ${elementId}`);
          return;
        }
        let resolvedLocator = locatorResolver.resolve(elementId);
        if (resolvedLocator && resolvedLocator.includes('${data}')) {
          resolvedLocator = resolvedLocator.replace(/\${data}/g, 'test_val');
        }
        if (!resolvedLocator) {
          console.log(`❌ [ERROR] ${elementId}: Không giải quyết được selector.`);
          failCount++;
          return;
        }
        try {
          const locator = page.locator(resolvedLocator);
          const count = await locator.count();
          if (count > 0) {
            const visible = await locator.first().isVisible();
            if (visible) {
              console.log(`✅ [VISIBLE] ${elementId} (Selector: ${resolvedLocator})`);
              if (writer) {
                await writer.updateElementResult(mod.moduleName, elementId, { status: 'PASS', observed: 'VISIBLE' });
              }
            } else {
              console.log(`⚠️ [HIDDEN IN DOM] ${elementId} (Selector: ${resolvedLocator})`);
              if (writer) {
                await writer.updateElementResult(mod.moduleName, elementId, { status: 'PASS', observed: 'HIDDEN IN DOM' });
              }
            }
            passCount++;
          } else {
            console.log(`❌ [NOT FOUND] ${elementId} (Selector: ${resolvedLocator})`);
            if (writer) {
              await writer.updateElementResult(mod.moduleName, elementId, { status: 'FAIL', observed: 'NOT FOUND' });
            }
            failCount++;
          }
        } catch (e) {
          console.log(`❌ [NOT FOUND] ${elementId} (Selector: ${resolvedLocator})`);
          if (writer) {
            await writer.updateElementResult(mod.moduleName, elementId, { status: 'FAIL', observed: 'NOT FOUND' });
          }
          failCount++;
        }
      };

      console.log(`\n--- BÁO CÁO KIỂM TRA TRẠNG THÁI ELEMENTS ---`);
      console.log(`Module: ${mod.moduleName.toUpperCase()}`);
      console.log(`------------------------------------------`);

      if (mod.moduleName.toLowerCase() === 'ds_cho_tiem') {

        const confirmPageElements = [
          'btn_scan_wristband', 'btn_view_screening', 'btn_view_prescription',
          'btn_transfer_room', 'btn_back_to_screening', 'btn_no_inject',
          'txt_nurse_name', 'txt_injection_time', 'switch_fridge',
          'ddl_injection_site', 'ddl_vaccine_lot', 'chk_consumable',
          'txt_consumable_qty', 'txt_notes', 'btn_confirm_injection'
        ];

        console.log(`[Phase 1] Quét các phần tử của trang Queue...`);
        for (const elConfig of mod.elements) {
          if (!confirmPageElements.includes(elConfig.element_id)) {
            await verifyElement(elConfig);
          }
        }

        console.log(`[ElementVerifier] Tự động chọn khách hàng đầu tiên để hiển thị trang xác nhận tiêm...`);
        if (!fs.existsSync('tmp')) {
          fs.mkdirSync('tmp', { recursive: true });
        }
        await page.screenshot({ path: 'tmp/before_click_ds_cho_tiem.png' });
        const firstRow = page.locator('tr:has-text("HIS-") >> nth=0').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(3000); // Chờ chuyển hướng sang trang /vaccination/confirm và panel hiển thị
          await page.screenshot({ path: 'tmp/after_click_ds_cho_tiem.png' });
        } else {
          console.log(`[ElementVerifier] Không tìm thấy first_row để click!`);
        }

        console.log(`[Phase 2] Quét các phần tử của trang Xác nhận tiêm...`);
        for (const elConfig of mod.elements) {
          if (confirmPageElements.includes(elConfig.element_id)) {
            await verifyElement(elConfig);
          }
        }
      } else {
        for (const elConfig of mod.elements) {
          await verifyElement(elConfig);
        }
      }

      console.log(`------------------------------------------`);
      console.log(`KẾT QUẢ QUÉT:`);
      console.log(`- Thành công (Visible / In DOM): ${passCount}`);
      console.log(`- Thất bại (Không tìm thấy): ${failCount}`);
      console.log(`------------------------------------------\n`);
    });
  });
}
