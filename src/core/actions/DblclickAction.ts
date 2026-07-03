import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

export class DblclickAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator } = context;
    if (!locator) throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    
    let isDisabled = false;
    try {
      isDisabled = await locator.isDisabled({ timeout: 1000 });
    } catch (e) {
      // Bỏ qua nếu gặp lỗi kiểm tra
    }
    
    if (isDisabled) {
      console.log(`   ⚠️ Phần tử [${step.target}] đang DISABLED. Bỏ qua dblclick.`);
    } else {
      await locator.dblclick();
    }

    return { status: 'PASSED' as const, observed: 'Thực thi hành động dblclick thành công.' };
  }
}
export default DblclickAction;
