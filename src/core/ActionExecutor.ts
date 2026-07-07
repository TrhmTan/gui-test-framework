import { Page } from '@playwright/test';
import { LocatorResolver } from './LocatorResolver';
import { DataResolver } from './DataResolver';
import { ExcelReader } from './ExcelReader';
import { TestCaseStep, PageConfig } from '../types';
import { ActionHandler, ActionHandlerContext } from './actions/ActionHandler';
import NavigateAction from './actions/NavigateAction';
import ClickAction from './actions/ClickAction';
import InputAction from './actions/InputAction';
import CheckStatusAction from './actions/CheckStatusAction';
import ClearAction from './actions/ClearAction';
import SelectAction from './actions/SelectAction';
import UploadFileAction from './actions/UploadFileAction';
import ScrollToAction from './actions/ScrollToAction';
import HoverAction from './actions/HoverAction';
import PressKeyAction from './actions/PressKeyAction';
import CaptureAction from './actions/CaptureAction';
import CheckValueAction from './actions/CheckValueAction';
import WaitForAction from './actions/WaitForAction';
import AssertUrlAction from './actions/AssertUrlAction';
import DblclickAction from './actions/DblclickAction';
import SetContextAction from './actions/SetContextAction';
import GetContextAction from './actions/GetContextAction';
import CaptureTextAction from './actions/CaptureTextAction';
import CheckVisualAction from './actions/CheckVisualAction';
import CheckA11yAction from './actions/CheckA11yAction';
import * as path from 'path';
import * as fs from 'fs';

export class ActionExecutor {
  private page: Page;
  private locatorResolver: LocatorResolver;
  private dataResolver: DataResolver;
  private excelReader: ExcelReader;
  private pagesMap: Map<string, string>;
  private handlers: Map<string, ActionHandler> = new Map();
  private allowedActions: Set<string> = new Set();

  constructor(
    page: Page,
    locatorResolver: LocatorResolver,
    dataResolver: DataResolver,
    excelReader: ExcelReader,
    pages: PageConfig[]
  ) {
    this.page = page;
    this.locatorResolver = locatorResolver;
    this.dataResolver = dataResolver;
    this.excelReader = excelReader;
    this.pagesMap = new Map(pages.map(p => [p.page_key, p.url]));

    this.loadAllowedActions();
    this.registerHandlers();
  }

  /**
   * Đọc danh sách action hợp lệ từ config/actions.txt
   */
  private loadAllowedActions() {
    const filePath = path.resolve(process.cwd(), 'config/actions.txt');
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const actionName = trimmed.split(':')[0].trim().toLowerCase();
            if (actionName) {
              this.allowedActions.add(actionName);
            }
          }
        });
        console.log(`[ActionExecutor] Đã nạp ${this.allowedActions.size} action hợp lệ từ config/actions.txt`);
      } catch (e: any) {
        console.error('[ActionExecutor] Lỗi đọc actions.txt:', e.message);
      }
    } else {
      console.warn('[ActionExecutor] Warning: Không tìm thấy config/actions.txt. Bỏ qua kiểm tra registry.');
    }
  }

  /**
   * Đăng ký các handler thực thi action
   */
  private registerHandlers() {
    this.handlers.set('navigate', new NavigateAction());
    this.handlers.set('click', new ClickAction());
    this.handlers.set('input', new InputAction());
    this.handlers.set('check_status', new CheckStatusAction());
    this.handlers.set('clear', new ClearAction());
    this.handlers.set('select', new SelectAction());
    this.handlers.set('upload_file', new UploadFileAction());
    this.handlers.set('scroll_to', new ScrollToAction());
    this.handlers.set('hover', new HoverAction());
    this.handlers.set('press_key', new PressKeyAction());
    this.handlers.set('capture', new CaptureAction());
    this.handlers.set('check_value', new CheckValueAction());
    // New keywords — Zero Hard Sleep policy
    this.handlers.set('wait_for', new WaitForAction());
    this.handlers.set('assert_url', new AssertUrlAction());
    this.handlers.set('dblclick', new DblclickAction());
    // Cross-module data flow (Phase 3)
    this.handlers.set('set_context', new SetContextAction());
    this.handlers.set('get_context', new GetContextAction());
    this.handlers.set('capture_text', new CaptureTextAction());
    // Visual regression testing (Playwright toHaveScreenshot)
    this.handlers.set('check_visual', new CheckVisualAction());
    // Accessibility testing (axe-core)
    this.handlers.set('check_a11y', new CheckA11yAction());
  }

  /**
   * Thực thi một bước kịch bản kiểm thử (Test Step)
   * @param step Dòng step đọc từ Excel
   * @param contextData Bảng test data động của test case hiện tại
   * @returns Kết quả chạy: status (PASSED/FAILED), observed (mô tả lỗi hoặc kết quả thực tế), screenshotPath (nếu có lỗi)
   */
  async executeStep(
    step: TestCaseStep,
    contextData: Record<string, any>,
    tcId?: string
  ): Promise<{ status: 'PASSED' | 'FAILED' | 'TBD'; observed: string; expected?: string; screenshotPath?: string }> {
    const actionLower = step.action.toLowerCase();

    // 1. Kiểm duyệt tính hợp lệ trong danh mục actions.txt
    if (this.allowedActions.size > 0 && !this.allowedActions.has(actionLower)) {
      throw new Error(`Hành động [${step.action}] không được khai báo trong danh mục config/actions.txt`);
    }

    // 2. Tìm kiếm handler đăng ký
    const handler = this.handlers.get(actionLower);
    if (!handler) {
      throw new Error(`Hành động keyword không được hỗ trợ hoặc chưa đăng ký handler: ${step.action}`);
    }

    // 3. Giải quyết biến động trong value và expected
    let resolvedValue = this.dataResolver.resolve(step.value, contextData);
    const resolvedExpected = this.dataResolver.resolve(step.expected, contextData);

    // Xử lý từ khóa đặc biệt n/a (not apply - bỏ qua bước)
    if (resolvedValue && resolvedValue.toLowerCase() === 'n/a') {
      const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
      console.log(`${workerPrefix}⏩ [SKIP] Bỏ qua bước [${step.action}] trên [${step.target}] do giá trị là N/A.`);
      return {
        status: 'PASSED' as const,
        observed: `Bỏ qua bước do giá trị là N/A (not apply).`
      };
    }

    // Xử lý từ khóa đặc biệt empty (để trống - truyền chuỗi rỗng)
    if (resolvedValue && resolvedValue.toLowerCase() === 'empty') {
      resolvedValue = '';
    }

    // 4. Định vị locator cho các action UI thông thường
    const locatorString = this.locatorResolver.resolve(step.target, resolvedValue);
    let locator = locatorString ? this.page.locator(locatorString) : null;

    // Xử lý locator thông minh để tránh strict mode violation khi trùng lặp (background hoặc cha-con)
    if (locator) {
      const isInteractiveAction = ['click', 'input', 'select', 'clear', 'hover', 'dblclick', 'scroll_to', 'press_key', 'upload_file'].includes(actionLower);

      if (isInteractiveAction) {
        // Đợi ít nhất 1 element xuất hiện trong DOM để có count chính xác
        await locator.first().waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
        const count = await locator.count().catch(() => 0);
        if (count > 1) {
          const visibleLocator = locator.filter({ visible: true });
          const visibleCount = await visibleLocator.count().catch(() => 0);
          if (visibleCount > 0) {
            locator = visibleLocator.first();
          } else {
            locator = locator.first();
          }
        }
      }
    }

    try {
      let logMsg = `  \x1b[36m[Step ${step.step}]\x1b[0m \x1b[1m${step.action}\x1b[0m -> \x1b[35m${step.target}\x1b[0m`;
      if (resolvedValue !== undefined && resolvedValue !== '') {
        logMsg += ` = \x1b[33m"${resolvedValue}"\x1b[0m`;
      }
      const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
      console.log(`${workerPrefix}${logMsg}`);

      const context: ActionHandlerContext = {
        page: this.page,
        locatorResolver: this.locatorResolver,
        dataResolver: this.dataResolver,
        excelReader: this.excelReader,
        pagesMap: this.pagesMap,
        contextData,
        tcId,
        resolvedValue,
        resolvedExpected,
        locator,
        locatorString
      };

      const handlerResult = await handler.execute(step, context);
      return {
        status: handlerResult.status,
        observed: handlerResult.observed,
        expected: (handlerResult as any).expected || resolvedExpected,
        screenshotPath: handlerResult.screenshotPath
      };
    } catch (error: any) {
      // Chụp ảnh màn hình tự động khi có lỗi
      const runId = contextData.__runId || `run_${Date.now()}`;
      const testCasePrefix = tcId ? `${tcId}_` : '';
      const failName = `fail_${testCasePrefix}step${step.step}_${Date.now()}.png`;
      const screenshotPath = path.resolve(process.cwd(), 'reports', runId, 'screenshots', failName);
      
      const workerPrefix = process.env.TEST_WORKER_INDEX ? `[Worker ${process.env.TEST_WORKER_INDEX}] ` : '';
      try {
        await this.page.screenshot({ path: screenshotPath });
        console.error(`${workerPrefix}     \x1b[31m⚠️ Lỗi thực tế: ${error.message || error}\x1b[0m`);
        console.error(`${workerPrefix}     \x1b[90m📷 Ảnh chụp lỗi: ${screenshotPath}\x1b[0m`);
      } catch (screenshotError) {
        console.error(`${workerPrefix}     \x1b[31m⚠️ Lỗi thực tế: ${error.message || error}\x1b[0m`);
        console.error(`${workerPrefix}     \x1b[90m⚠️ Failed to capture screenshot on error:\x1b[0m`, screenshotError);
      }

      if (error.name === 'AssertionFailedError') {
        return {
          status: 'FAILED',
          observed: `So sánh thất bại: Thực tế là "${error.observed}" nhưng kỳ vọng là "${error.expected}"`,
          expected: error.expected,
          screenshotPath: `screenshots/${failName}`
        };
      }

      const cleanMsg = cleanErrorMessage(error.message || String(error));
      return {
        status: 'FAILED',
        observed: `[Step ${step.step}] Lỗi thực thi [${step.action}] trên [${step.target || 'N/A'}]: ${cleanMsg}`,
        screenshotPath: `screenshots/${failName}`
      };
    }
  }
}

function cleanErrorMessage(msg: string): string {
  if (!msg) return '';
  
  // 1. Loại bỏ các mã màu ANSI (ANSI escape codes)
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  let cleaned = msg.replace(ansiRegex, '');
  
  // 2. Tìm và cắt bỏ phần logs hoặc call log của Playwright
  const cutPoints = [
    'Call log:',
    '=========================== logs ===========================',
    '==== logs ====',
    '=========================== log ===========================',
    '==== log ===='
  ];
  
  for (const point of cutPoints) {
    const idx = cleaned.indexOf(point);
    if (idx !== -1) {
      cleaned = cleaned.substring(0, idx);
    }
  }
  
  // 3. Chuẩn hóa dòng trống và khoảng trắng
  const lines = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
    
  return lines.join('\n');
}

export default ActionExecutor;
