import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

/**
 * WaitForAction — chờ element/page đạt trạng thái mong đợi.
 *
 * Thay thế hoàn toàn waitForTimeout() — Zero Hard Sleep.
 *
 * Cú pháp trong Excel (step):
 *   action   | target              | value
 *   wait_for | btn_confirm         | visible      → chờ element hiện ra
 *   wait_for | loading_overlay     | hidden       → chờ overlay ẩn đi
 *   wait_for | loading_overlay     | detached     → chờ element bị xóa khỏi DOM
 *   wait_for | page                | networkidle  → chờ network nhàn rỗi
 *   wait_for | page                | domloaded    → chờ DOMContentLoaded
 */
export class WaitForAction implements ActionHandler {
  private readonly PAGE_STATES = ['networkidle', 'domloaded', 'load'] as const;
  private readonly ELEMENT_STATES = ['visible', 'hidden', 'attached', 'detached'] as const;
  private readonly DEFAULT_TIMEOUT = 15_000; // ms

  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const state = (context.resolvedValue || 'visible').toLowerCase().trim();
    const target = (step.target || '').toLowerCase().trim();
    const expectedType = (step.expected || '').toLowerCase().trim();

    // --- Wait for URL state ---
    if (expectedType === 'url') {
      const urlPattern = context.resolvedValue || '';
      if (!urlPattern) {
        throw new Error('WaitForAction: Thiếu pattern URL ở cột value.');
      }
      console.log(`   ⏳ Waiting for URL to match: [${urlPattern}]`);
      await context.page.waitForURL(urlPattern, { timeout: this.DEFAULT_TIMEOUT });

      return {
        status: 'PASSED' as const,
        observed: `URL đã chuyển đổi và khớp với: ${urlPattern}`,
      };
    }

    // --- Wait for PAGE state ---
    if (target === 'page') {
      const loadState = state === 'networkidle'
        ? 'networkidle'
        : state === 'load'
          ? 'load'
          : 'domcontentloaded';

      console.log(`   ⏳ Waiting for page state: [${loadState}]`);
      await context.page.waitForLoadState(loadState);

      return {
        status: 'PASSED' as const,
        observed: `Page đạt trạng thái: ${loadState}`,
      };
    }

    // --- Wait for ELEMENT state ---
    const locator = context.locator;
    if (!locator) {
      throw new Error(`WaitForAction: Không tìm thấy locator cho target "${step.target}". Kiểm tra ELEMENT sheet.`);
    }

    const waitState = (this.ELEMENT_STATES as readonly string[]).includes(state)
      ? (state as 'visible' | 'hidden' | 'attached' | 'detached')
      : 'visible';

    console.log(`   ⏳ Waiting for [${step.target}] → state: [${waitState}]`);
    await locator.waitFor({ state: waitState, timeout: this.DEFAULT_TIMEOUT });

    return {
      status: 'PASSED' as const,
      observed: `Element [${step.target}] đạt trạng thái: ${waitState}`,
    };
  }
}

export default WaitForAction;
