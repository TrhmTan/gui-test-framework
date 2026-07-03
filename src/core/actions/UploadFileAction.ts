import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import * as path from 'path';

export class UploadFileAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator, resolvedValue } = context;
    if (!locator) throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    const filePath = path.resolve(process.cwd(), 'data/assets', resolvedValue);
    await locator.setInputFiles(filePath);
    return { status: 'PASSED' as const, observed: 'Thực thi hành động thành công.' };
  }
}
export default UploadFileAction;
