import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { sharedContext } from '../SharedRuntimeContext';

// ═══════════════════════════════════════════════════════════════
// GetContextAction — Đọc giá trị từ SharedRuntimeContext và fill
// ═══════════════════════════════════════════════════════════════
// Excel usage:
//   action=get_context | target=patient_name | value=txt_search
//   → Đọc "patient_name" từ context, fill vào element "txt_search"
//
//   action=get_context | target=patient_code
//   → Đọc "patient_code" từ context, chỉ trả về observed (không fill)
// ═══════════════════════════════════════════════════════════════

export class GetContextAction implements ActionHandler {
  async execute(
    step: TestCaseStep,
    context: ActionHandlerContext
  ): Promise<{ status: 'PASSED' | 'FAILED' | 'TBD'; observed: string }> {
    const key = step.target;
    if (!key) {
      return {
        status: 'FAILED',
        observed: '[get_context] Thiếu target (tên key cần đọc)'
      };
    }

    const value = sharedContext.get(key);
    if (!value) {
      console.warn(`   ⚠️ [get_context] Key "${key}" không tồn tại hoặc rỗng trong SharedRuntimeContext`);
    }

    // Nếu có value (= element_id target), fill giá trị vào element
    if (step.value && context.page) {
      const elementId = step.value.trim();
      const locatorString = context.locatorResolver.resolve(elementId, '');

      if (locatorString) {
        const targetLocator = context.page.locator(locatorString);
        await targetLocator.waitFor({ state: 'visible', timeout: 5000 });
        await targetLocator.fill(value);
        console.log(`   📖 [get_context] ${key} = "${value}" → fill vào ${elementId}`);
      } else {
        return {
          status: 'FAILED',
          observed: `[get_context] Không tìm thấy locator cho element "${elementId}"`
        };
      }
    } else {
      console.log(`   📖 [get_context] ${key} = "${value}" (read-only, không fill)`);
    }

    return {
      status: 'PASSED',
      observed: `Context get: ${key}=${value}`
    };
  }
}

export default GetContextAction;
