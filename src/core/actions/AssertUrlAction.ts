import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

/**
 * AssertUrlAction - kiem tra URL hien tai cua browser.
 *
 * Cu phap trong Excel (step):
 *   action     | expected
 *   assert_url | wildcard: star/vaccination/queue*star  -> wildcard match
 *   assert_url | /vaccination/confirm                   -> contains match
 *   assert_url | https://test-smh.../confirm            -> exact URL match
 *
 * Wildcard (*) ho tro o dau va cuoi pattern.
 */
export class AssertUrlAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const currentUrl = context.page.url();
    const pattern = (context.resolvedExpected || step.expected || '').trim();

    if (!pattern) {
      throw new Error('AssertUrlAction: Thiếu giá trị expected (URL pattern cần kiểm tra).');
    }

    let isMatch = false;
    let matchMode = '';

    if (pattern.includes('*')) {
      // Wildcard mode: * → .*
      matchMode = 'wildcard';
      const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      isMatch = new RegExp(regexStr, 'i').test(currentUrl);
    } else if (pattern.startsWith('http')) {
      // Exact URL mode
      matchMode = 'exact';
      isMatch = currentUrl.toLowerCase() === pattern.toLowerCase();
    } else {
      // Contains mode (partial path)
      matchMode = 'contains';
      isMatch = currentUrl.toLowerCase().includes(pattern.toLowerCase());
    }

    console.log(`   🔗 AssertURL [${matchMode}]: "${currentUrl}" ↔ "${pattern}" → ${isMatch ? 'MATCH ✅' : 'NO MATCH ❌'}`);

    if (!isMatch) {
      return {
        status: 'FAILED' as const,
        observed: `URL không khớp. Hiện tại: "${currentUrl}" — Expected: "${pattern}"`,
      };
    }

    return {
      status: 'PASSED' as const,
      observed: `URL hợp lệ: "${currentUrl}" khớp với pattern "${pattern}"`,
    };
  }
}

export default AssertUrlAction;
