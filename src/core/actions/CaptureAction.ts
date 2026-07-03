import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import * as path from 'path';

export class CaptureAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { page, contextData } = context;
    const runId = contextData.__runId || `run_${Date.now()}`;
    const captureName = `capture_${step.step}_${Date.now()}.png`;
    const capturePath = path.resolve(process.cwd(), 'reports', runId, 'screenshots', captureName);
    await page.screenshot({ path: capturePath });
    return {
      status: 'PASSED' as const,
      observed: `Đã chụp ảnh màn hình: ${captureName}`,
      screenshotPath: `screenshots/${captureName}`
    };
  }
}
export default CaptureAction;
