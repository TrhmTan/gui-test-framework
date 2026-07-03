import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

export class InputAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator, resolvedValue } = context;
    if (!locator) throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    
    let valueToFill = resolvedValue;

    // Auto-detect input type="date" and convert format from DD/MM/YYYY to YYYY-MM-DD if needed
    try {
      const typeAttr = await locator.getAttribute('type').catch(() => null);
      if (typeAttr === 'date' && resolvedValue) {
        const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
        const match = resolvedValue.trim().match(dateRegex);
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          valueToFill = `${year}-${month}-${day}`;
          console.log(`🔧 [InputAction] Auto-converted date from "${resolvedValue}" to "${valueToFill}" for input[type="date"]`);
        }
      }
    } catch (e) {
      // Fail-safe: ignore attribute errors and proceed with raw value
    }
    
    // Auto-scroll element into view to prevent timeout on elements below viewport
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.fill(valueToFill);
    return { status: 'PASSED' as const, observed: 'Thực thi hành động thành công.' };
  }
}
export default InputAction;
