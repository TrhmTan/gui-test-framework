import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

/**
 * NavigateAction — điều hướng tới URL được chỉ định.
 *
 * Nguyên tắc: Single Responsibility + Zero Hard Sleep
 *  - KHÔNG chứa bất kỳ business logic nào (chọn phòng tiêm, chọn ca trực...)
 *  - KHÔNG dùng waitForTimeout() — dùng { waitUntil: 'domcontentloaded' } thay thế
 *  - Logic khởi tạo ca/phòng → khai báo trong PRECONDITION sheet (pre_init_shift)
 */
export class NavigateAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    let targetUrl = '';

    if (step.target && context.pagesMap.has(step.target)) {
      // Look up URL from PAGE sheet in preconditions.xlsx
      targetUrl = context.pagesMap.get(step.target)!;
    } else {
      // Fallback: use raw value/expected as URL
      targetUrl = context.resolvedValue || context.resolvedExpected || step.target;
    }

    if (!targetUrl) {
      throw new Error(`Không xác định được URL để điều hướng cho target: "${step.target}"`);
    }

    const currentUrl = context.page.url();
    let isSamePage = false;
    try {
      const currentPath = new URL(currentUrl).pathname;
      const targetPath = targetUrl.startsWith('http') ? new URL(targetUrl).pathname : targetUrl;
      isSamePage = currentPath === targetPath || currentPath.endsWith(targetPath) || targetPath.endsWith(currentPath);
    } catch (e) {
      isSamePage = currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl);
    }

    if (isSamePage) {
      const isRoomSelected = await context.page.locator('[data-testid="vaccination-session-toolbar-room-select"]').isVisible().catch(() => false);
      const isPromptVisible = await context.page.locator('text="Vui lòng chọn phòng tiêm"').isVisible().catch(() => false);
      
      if (isRoomSelected && !isPromptVisible) {
        console.log(`   ⚡ [Navigate Bypass] Đang ở đúng trang và phòng trực đã được chọn sẵn. Bỏ qua navigate để giữ state.`);
        return {
          status: 'PASSED' as const,
          observed: `Điều hướng thành công (Bypass - giữ nguyên trạng thái trang hiện tại)`,
        };
      }
    }

    console.log(`   ➔ Navigating to: ${targetUrl}`);
    await context.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Đợi trang load hoàn tất và mạng nhàn rỗi (ổn định API)
    await context.page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await context.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    // Đợi thêm: chờ loading overlay/spinner ẩn (nếu có) thay vì hard sleep
    const loadingOverlays = ['.ant-spin-spinning', '.loading-overlay', '[class*="loading"]', '.spinner'];
    for (const sel of loadingOverlays) {
      try {
        const spinner = context.page.locator(sel).first();
        if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
          await spinner.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          break;
        }
      } catch { /* Không có spinner → bỏ qua */ }
    }

    return {
      status: 'PASSED' as const,
      observed: `Điều hướng thành công tới: ${targetUrl}`,
    };
  }
}

export default NavigateAction;
