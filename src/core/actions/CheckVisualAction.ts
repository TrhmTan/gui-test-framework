import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { expect, Locator } from '@playwright/test';
import { AssertionFailedError } from '../errors/AssertionFailedError';

/** Các giá trị Target được coi là "chụp toàn trang" thay vì 1 phần tử cụ thể */
const FULL_PAGE_TARGETS = ['', 'page', 'full_page', 'fullpage', 'toan_trang'];

/**
 * Cú pháp cột Expected cho check_visual (tùy chọn, có thể để trống):
 *   - "mask:element_id_1,element_id_2"  → che các vùng động (avatar, timestamp...) trước khi so sánh
 *   - "threshold:0.03"                   → nới ngưỡng % pixel khác biệt cho phép (mặc định lấy từ playwright.config.ts)
 *   - "0.03"                             → viết tắt của threshold ở trên
 *   - Kết hợp nhiều mục bằng dấu ";": "mask:lbl_updated_at;threshold:0.05"
 */
function parseVisualOptions(expected: string): { maskKeys: string[]; maxDiffPixelRatio?: number } {
  const maskKeys: string[] = [];
  let maxDiffPixelRatio: number | undefined;

  if (!expected) return { maskKeys, maxDiffPixelRatio };

  const parts = expected.split(';').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('mask:')) {
      maskKeys.push(...part.substring(5).split(',').map(k => k.trim()).filter(Boolean));
    } else if (lower.startsWith('threshold:')) {
      const val = parseFloat(part.substring(10).trim());
      if (!isNaN(val)) maxDiffPixelRatio = val;
    } else {
      // Cho phép viết tắt: Expected = "0.05" hiểu luôn là threshold
      const val = parseFloat(part);
      if (!isNaN(val)) maxDiffPixelRatio = val;
    }
  }
  return { maskKeys, maxDiffPixelRatio };
}

export class CheckVisualAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { page, locator, locatorResolver, resolvedValue, resolvedExpected, tcId } = context;

    const targetKey = (step.target || '').trim().toLowerCase();
    const isFullPage = FULL_PAGE_TARGETS.includes(targetKey);

    if (!isFullPage && !locator) {
      throw new Error(`Không tìm thấy locator cho phần tử cần so sánh ảnh: ${step.target}`);
    }

    // Tên file baseline: ưu tiên Value do người dùng đặt, nếu không tự sinh từ tc_id + step + target
    // Lưu ý: baseline được đặt tên cố định theo tc_id/step, không tự thêm index iteration —
    // nếu test case data-driven mà giao diện đổi theo dữ liệu, hãy tự đặt tên riêng ở cột Value.
    const rawName = (resolvedValue && resolvedValue.trim() !== '')
      ? resolvedValue.trim()
      : `${tcId || 'TC'}_step${step.step}_${targetKey || 'page'}`;
    const snapshotName = (rawName.endsWith('.png') ? rawName : `${rawName}.png`).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const { maskKeys, maxDiffPixelRatio } = parseVisualOptions(resolvedExpected);
    const maskLocators: Locator[] = maskKeys
      .map(key => locatorResolver.resolve(key, ''))
      .filter((sel): sel is string => !!sel)
      .map(sel => page.locator(sel));

    const screenshotOptions: Record<string, any> = {
      animations: 'disabled',
      ...(maskLocators.length > 0 ? { mask: maskLocators } : {}),
      ...(maxDiffPixelRatio !== undefined ? { maxDiffPixelRatio } : {})
    };

    try {
      if (isFullPage) {
        await expect(page).toHaveScreenshot(snapshotName, { ...screenshotOptions, fullPage: true });
      } else {
        await expect(locator as Locator).toHaveScreenshot(snapshotName, screenshotOptions);
      }

      return {
        status: 'PASSED' as const,
        observed: `Giao diện khớp với ảnh baseline [${snapshotName}]`,
        expected: snapshotName
      };
    } catch (e: any) {
      const rawMsg = e.message || String(e);
      const isMissingBaseline = /(no expected snapshot|missing.*snapshot|snapshot doesn't exist|didn't exist)/i.test(rawMsg);
      const reason = isMissingBaseline
        ? `Chưa có ảnh baseline [${snapshotName}]. Chạy lại kèm cờ --update-snapshots để tạo baseline lần đầu.`
        : `Giao diện lệch so với baseline [${snapshotName}] (xem ảnh -actual/-diff trong test-results/)`;
      throw new AssertionFailedError(reason, snapshotName);
    }
  }
}

export default CheckVisualAction;
