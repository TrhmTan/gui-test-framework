import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { expect } from '@playwright/test';
import * as path from 'path';
import { AssertionFailedError } from '../errors/AssertionFailedError';

export class CheckStatusAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator, page, resolvedValue, resolvedExpected, tcId, contextData } = context;

    const actualExpectation = resolvedExpected || resolvedValue;

    if (!locator) {
      throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    }

    // Hỗ trợ trạng thái TBD: Chưa rõ expected, chưa có target/locator hoặc target/locator không hợp lệ
    if (!actualExpectation || actualExpectation.trim() === '' || actualExpectation.toLowerCase() === 'tbd') {
      console.log(`   ⚠️ [TBD] Check_status chưa rõ expected hoặc thiếu giá trị kỳ vọng cho [${step.target}].`);
      return {
        status: 'TBD' as const,
        observed: 'TBD',
        screenshotPath: undefined
      };
    }

    await this.handleCheckStatus(locator, actualExpectation);

    // Tự động chụp ảnh màn hình minh chứng sau khi check_status thành công
    const checkRunId = contextData.__runId || `run_${Date.now()}`;
    const screenshotName = `check_${tcId || 'TC'}_step${step.step}_${Date.now()}.png`;
    const checkScreenshotPath = path.resolve(process.cwd(), 'reports', checkRunId, 'screenshots', screenshotName);
    try {
      await page.screenshot({ path: checkScreenshotPath });
      return {
        status: 'PASSED' as const,
        observed: actualExpectation,
        expected: actualExpectation,
        screenshotPath: `screenshots/${screenshotName}`
      };
    } catch (e) {
      console.error(`   ⚠️ Không thể chụp ảnh minh chứng cho check_status:`, e);
      return { status: 'PASSED' as const, observed: actualExpectation, expected: actualExpectation };
    }
  }

  private async handleCheckStatus(locator: any, expectation: string) {
    const exp = expectation.toLowerCase();
    const ASSERTION_TIMEOUT = 10_000; // 10s — tránh flaky với toast notification thoáng qua
    try {
      if (exp === 'visible' || exp === 'displayed') {
        await expect(locator).toBeVisible({ timeout: ASSERTION_TIMEOUT });
      } else if (exp === 'hidden' || exp === 'invisible' || exp === 'not visible' || exp === 'not_visible') {
        await expect(locator).toBeHidden({ timeout: ASSERTION_TIMEOUT });
      } else if (exp === 'enabled') {
        await expect(locator).toBeEnabled();
      } else if (exp === 'disabled') {
        await expect(locator).toBeDisabled();
      } else if (exp === 'checked') {
        await expect(locator).toBeChecked();
      } else if (exp === 'unchecked') {
        await expect(locator).not.toBeChecked();
      } else {
        // Nếu là văn bản tự nhiên, xác thực text hiển thị của element
        await expect(locator).toHaveText(expectation);
      }
    } catch (e) {
      const actual = await this.getActualStatus(locator, expectation);
      throw new AssertionFailedError(actual, expectation);
    }
  }

  private async getActualStatus(locator: any, expectation: string): Promise<string> {
    const exp = expectation.toLowerCase();
    try {
      const count = await locator.count().catch(() => 0);
      if (count === 0) return 'not visible';

      if (exp === 'visible' || exp === 'displayed' || exp === 'hidden' || exp === 'invisible' || exp === 'not visible' || exp === 'not_visible') {
        const isVisible = await locator.isVisible().catch(() => false);
        return isVisible ? 'visible' : 'not visible';
      }
      if (exp === 'enabled' || exp === 'disabled') {
        const isEnabled = await locator.isEnabled().catch(() => false);
        return isEnabled ? 'enabled' : 'disabled';
      }
      if (exp === 'checked' || exp === 'unchecked') {
        const isChecked = await locator.isChecked().catch(() => false);
        return isChecked ? 'checked' : 'unchecked';
      }

      const text = await locator.innerText().catch(() => '');
      return text.trim() || 'empty';
    } catch (err) {
      return 'error';
    }
  }
}
export default CheckStatusAction;
