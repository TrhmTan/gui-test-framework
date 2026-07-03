import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

export class ClearAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator } = context;
    if (!locator) throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    await locator.clear();
    return { status: 'PASSED' as const, observed: 'Thực thi hành động thành công.' };
  }
}
export default ClearAction;
