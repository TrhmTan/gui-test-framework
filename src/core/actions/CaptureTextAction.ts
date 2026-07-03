import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { sharedContext } from '../SharedRuntimeContext';

// ═══════════════════════════════════════════════════════════════
// CaptureTextAction — Chụp text từ UI element → lưu vào context
// ═══════════════════════════════════════════════════════════════
// Excel usage:
//   action=capture_text | target=lbl_patient_code | value=patient_code
//   → Đọc innerText từ element "lbl_patient_code", lưu vào context key "patient_code"
//
//   action=capture_text | target=lbl_queue_number | value=queue_no
//   → Đọc text hiển thị "STT 05", lưu "STT 05" vào key "queue_no"
// ═══════════════════════════════════════════════════════════════

export class CaptureTextAction implements ActionHandler {
  async execute(
    step: TestCaseStep,
    context: ActionHandlerContext
  ): Promise<{ status: 'PASSED' | 'FAILED' | 'TBD'; observed: string }> {
    // target = element_id để lấy text
    // value = key name để lưu vào context
    if (!context.locator) {
      return {
        status: 'FAILED',
        observed: `[capture_text] Không tìm thấy locator cho element "${step.target}"`
      };
    }

    try {
      // Đợi element visible trước khi đọc text
      await context.locator.waitFor({ state: 'visible', timeout: 10000 });

      // Đọc text — ưu tiên inputValue cho form elements, fallback innerText
      let capturedText = '';
      const tagName = await context.locator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');

      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        capturedText = await context.locator.inputValue().catch(() => '');
      }

      // Nếu không lấy được inputValue, thử innerText
      if (!capturedText) {
        capturedText = await context.locator.innerText().catch(() => '');
      }

      // Nếu vẫn rỗng, thử textContent
      if (!capturedText) {
        capturedText = await context.locator.textContent().catch(() => '') || '';
      }

      capturedText = capturedText.trim();

      // Key mặc định = resolvedValue (đã resolve $data pattern), fallback step.value, fallback step.target
      const contextKey = context.resolvedValue || step.value || step.target;
      sharedContext.set(contextKey, capturedText);

      console.log(`   📸 [capture_text] ${step.target} → ${contextKey} = "${capturedText}"`);
      return {
        status: 'PASSED',
        observed: `Captured: ${contextKey}="${capturedText}"`
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        observed: `[capture_text] Lỗi khi đọc text từ "${step.target}": ${err.message}`
      };
    }
  }
}

export default CaptureTextAction;
