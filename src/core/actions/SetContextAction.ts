import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { sharedContext } from '../SharedRuntimeContext';

// ═══════════════════════════════════════════════════════════════
// SetContextAction — Lưu giá trị vào SharedRuntimeContext
// ═══════════════════════════════════════════════════════════════
// Excel usage:
//   action=set_context | target=patient_name | value=$data_xxx.txt_fullname
//   → Lưu giá trị đã resolve vào context key "patient_name"
//
//   action=set_context | target=room_label | value=Phòng tiêm 01
//   → Lưu giá trị cứng "Phòng tiêm 01" vào context key "room_label"
// ═══════════════════════════════════════════════════════════════

export class SetContextAction implements ActionHandler {
  async execute(
    step: TestCaseStep,
    context: ActionHandlerContext
  ): Promise<{ status: 'PASSED' | 'FAILED' | 'TBD'; observed: string }> {
    const key = step.target;
    if (!key) {
      return {
        status: 'FAILED',
        observed: '[set_context] Thiếu target (tên key cần lưu)'
      };
    }

    const value = context.resolvedValue || '';
    sharedContext.set(key, value);

    console.log(`   📝 [set_context] ${key} = "${value}"`);
    return {
      status: 'PASSED',
      observed: `Context set: ${key}=${value}`
    };
  }
}

export default SetContextAction;
