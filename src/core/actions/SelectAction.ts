import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';

export class SelectAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { page, locator, resolvedValue } = context;
    if (!locator) throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
    
    // 1. Kiểm tra xem phần tử có phải là thẻ select chuẩn của HTML hay không
    const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
    
    if (tagName === 'select') {
      await locator.selectOption(resolvedValue);
    } else {
      // 2. Xử lý dropdown giả lập (Ant Design, custom combobox...)
      console.log(`     [Select] Phát hiện dropdown giả lập. Đang thực hiện mở và chọn value: "${resolvedValue}"`);
      
      // Click vào dropdown để mở menu danh sách
      await locator.click();
      // Chờ dropdown menu render — tìm container dropdown xuất hiện thay vì hard sleep
      const dropdownWaitSelectors = ['.ant-select-dropdown', '[role="listbox"]', '.select-dropdown', '.dropdown-menu'];
      let dropdownVisible = false;
      for (const sel of dropdownWaitSelectors) {
        try {
          await page.locator(sel).first().waitFor({ state: 'visible', timeout: 2000 });
          dropdownVisible = true;
          break;
        } catch { /* Thử selector tiếp theo */ }
      }
      if (!dropdownVisible) {
        // Fallback: chờ ngắn nếu không tìm thấy dropdown container nào
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }

      // --- BẮT ĐẦU PHẦN NÂNG CẤP CHỌN ĐỘNG ---
      if (resolvedValue === 'RANDOM' || resolvedValue.toUpperCase().startsWith('INDEX:')) {
        const itemSelectors = [
          '.ant-select-item-option',
          'div[role="option"]',
          'li[role="option"]',
          '.select-option'
        ];
        let optionsLocator = null;
        for (const sel of itemSelectors) {
          const loc = page.locator(sel);
          const count = await loc.count().catch(() => 0);
          if (count > 0) {
            optionsLocator = loc;
            break;
          }
        }

        if (optionsLocator) {
          const count = await optionsLocator.count();
          let targetIndex = 0;
          if (resolvedValue === 'RANDOM') {
            targetIndex = Math.floor(Math.random() * count);
          } else {
            const idx = parseInt(resolvedValue.split(':')[1]) - 1;
            targetIndex = Math.max(0, Math.min(idx, count - 1));
          }
          await optionsLocator.nth(targetIndex).click();
          console.log(`     [Select] Đã chọn option thứ ${targetIndex + 1} thành công.`);
          return { status: 'PASSED' as const, observed: 'Thực thi hành động thành công.' };
        }
      }
      // --- KẾT THÚC PHẦN NÂNG CẤP CHỌN ĐỘNG ---

      // Danh sách các selector phổ biến cho dropdown option của các thư viện UI (AntD, Bootstrap, custom)
      const optionSelectors = [
        // 1. Khớp tuyệt đối (Exact match)
        `role=option >> text="${resolvedValue}"`,
        `.ant-select-dropdown :text-is("${resolvedValue}")`,
        `div[role="option"] >> text="${resolvedValue}"`,
        `li[role="option"] >> text="${resolvedValue}"`,
        `text="${resolvedValue}"`,

        // 2. Khớp một phần (Substring match / has-text)
        `role=option:has-text("${resolvedValue}")`,
        `.ant-select-item-option:has-text("${resolvedValue}")`,
        `.ant-select-dropdown :has-text("${resolvedValue}")`,
        `div[role="option"]:has-text("${resolvedValue}")`,
        `li[role="option"]:has-text("${resolvedValue}")`,
        `.select-option:has-text("${resolvedValue}")`,
        `text=${resolvedValue}`
      ];
      
      let clicked = false;
      for (const selector of optionSelectors) {
        const optionLocator = page.locator(selector).first();
        const isVisible = await optionLocator.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          await optionLocator.click();
          clicked = true;
          console.log(`     [Select] Đã click chọn option bằng selector: "${selector}"`);
          break;
        }
      }
      
      if (!clicked) {
        // Fallback khẩn cấp: Thử click trực tiếp vào text hiển thị trên viewport
        console.log(`     [Select] Thử click fallback khẩn cấp vào text hiển thị.`);
        const exactLocator = page.locator(`text="${resolvedValue}"`).first();
        const exactVisible = await exactLocator.isVisible({ timeout: 1000 }).catch(() => false);
        if (exactVisible) {
          await exactLocator.click();
        } else {
          console.log(`     [Select] Thử click fallback chứa text (substring match): "${resolvedValue}"`);
          await page.locator(`text=${resolvedValue}`).first().click({ timeout: 2000 });
        }
      }
    }
    
    return { status: 'PASSED' as const, observed: 'Thực thi hành động thành công.' };
  }
}
export default SelectAction;
