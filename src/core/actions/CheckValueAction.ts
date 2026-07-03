import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import * as path from 'path';
import { AssertionFailedError } from '../errors/AssertionFailedError';

function compareValues(observed: string, expected: string, isContains: boolean = false): boolean {
  if (isContains) {
    return observed.toLowerCase().includes(expected.toLowerCase());
  }
  if (expected.includes('*')) {
    const regexStr = '^' + expected.replace(/[-/\\^$+.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr, 'i');
    return regex.test(observed);
  }
  return observed.toLowerCase() === expected.toLowerCase();
}

export class CheckValueAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { locator, page, resolvedValue, resolvedExpected, tcId, contextData } = context;

    // Giá trị mong đợi có thể ở cột Expected hoặc cột Value trong kịch bản
    let expectation = resolvedExpected !== undefined && resolvedExpected !== null && resolvedExpected !== ''
      ? resolvedExpected 
      : resolvedValue;

    let isContainsOperator = false;
    // Nếu Expected là "contains" và Value có giá trị, hoặc Expected bắt đầu bằng "contains:"
    if (resolvedExpected && resolvedExpected.toLowerCase() === 'contains' && resolvedValue !== undefined && resolvedValue !== null && resolvedValue !== '') {
      expectation = resolvedValue;
      isContainsOperator = true;
    } else if (resolvedExpected && resolvedExpected.toLowerCase().startsWith('contains:')) {
      expectation = resolvedExpected.substring(9).trim();
      isContainsOperator = true;
    }



    let isCheckEmpty = false;
    if (expectation && expectation.toLowerCase() === 'empty') {
      expectation = '';
      isCheckEmpty = true;
    }

    // Hỗ trợ trạng thái TBD (To Be Defined)
    if (!isCheckEmpty && (expectation === undefined || expectation === null || expectation.trim() === '' || expectation.toLowerCase() === 'tbd')) {
      console.log(`   ⚠️ [TBD] check_value chưa rõ expected hoặc thiếu giá trị kỳ vọng cho [${step.target}].`);
      return {
        status: 'TBD' as const,
        observed: 'TBD',
        screenshotPath: undefined
      };
    }

    let observedValue = '';
    let isMatched = false;

    // 1. Phân loại theo Target hoặc tiền tố Target (không phân biệt hoa thường)
    const targetName = (step.target || '').toLowerCase();
    const isToast = ['toast', 'toast_message', 'toast-message', 'toastmessage'].includes(targetName);

    if (isToast) {
      // TH Toast Message: Quét toàn trang qua các class/role toast phổ biến
      const toastSelectors = [
        '.toast', '.toast-message', '[role="status"]', 
        '[role="alert"]', '.notification', '.ant-message', 
        '.ant-notification', '.toastify', '.sweet-alert', 
        '.alert', '.vue-toastification-toast'
      ];
      
      let foundToastText = '';
      for (const selector of toastSelectors) {
        const toastLocator = page.locator(selector);
        const count = await toastLocator.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          const el = toastLocator.nth(i);
          if (await el.isVisible().catch(() => false)) {
            const text = await el.innerText().catch(() => '');
            if (text.trim()) {
              foundToastText = text.trim();
              break;
            }
          }
        }
        if (foundToastText) break;
      }

      observedValue = foundToastText || '[Không tìm thấy toast message nào đang hiển thị]';
      isMatched = compareValues(observedValue, expectation, isContainsOperator);
    } else {
      if (!locator) {
        throw new Error(`Không tìm thấy locator cho phần tử: ${step.target}`);
      }

      const startTime = Date.now();
      const timeoutMs = 5000;
      const intervalMs = 250;

      while (true) {
        try {
          // Đợi element xuất hiện trên DOM (timeout ngắn để retry nhanh)
          await locator.waitFor({ state: 'attached', timeout: 1000 }).catch(() => {});

          const tagName = await locator.evaluate(el => el.tagName.toUpperCase()).catch(() => '');
          
          // Nhận diện loại phần tử theo prefix Naming Convention hoặc tag của DOM
          const isTextbox = targetName.startsWith('txt_') || tagName === 'TEXTAREA';
          const isSearchbox = targetName.startsWith('search_');
          const isDropdown = targetName.startsWith('ddl_') || targetName.startsWith('select_') || tagName === 'SELECT';
          const isCheckbox = targetName.startsWith('chk_') || targetName.startsWith('checkbox_');
          const isRadio = targetName.startsWith('rad_') || targetName.startsWith('radio_');
          const isSwitch = targetName.startsWith('sw_') || (await locator.getAttribute('role').catch(() => '')) === 'switch';
          const isButton = targetName.startsWith('btn_') || tagName === 'BUTTON';
          const isLink = targetName.startsWith('lnk_') || tagName === 'A';
          const isLabel = targetName.startsWith('lbl_');
          const isDiv = targetName.startsWith('div_');
          const isErrorMsg = targetName.startsWith('error_');

          if (isDropdown) {
            // Dropdown select: lấy giá trị được chọn
            if (tagName === 'SELECT') {
              const selectedOptions = await locator.evaluate((el: HTMLSelectElement) => 
                Array.from(el.selectedOptions).map(opt => (opt.text || opt.value || '').trim())
              ).catch(() => [] as string[]);
              observedValue = selectedOptions.join(', ');
              isMatched = selectedOptions.some(val => compareValues(val, expectation, isContainsOperator));
            } else {
              // Custom dropdown/select wrapper: Quét tìm thông báo lỗi liên kết trước (dành cho các test case validation lỗi)
              let errorMessage = '';
              
              // 1. Qua aria-describedby
              const ariaDescribedBy = await locator.getAttribute('aria-describedby').catch(() => null);
              if (ariaDescribedBy) {
                const ids = ariaDescribedBy.split(/\s+/);
                for (const id of ids) {
                  const errEl = page.locator(`#${id}`);
                  if (await errEl.count().catch(() => 0) > 0 && await errEl.isVisible().catch(() => false)) {
                    errorMessage = (await errEl.innerText().catch(() => '')).trim();
                    if (errorMessage) break;
                  }
                }
              }
              
              // 2. Qua sibling/parent error container
              if (!errorMessage) {
                const parent = locator.locator('xpath=..');
                const errorSelectors = [
                  '.error-message', '.error', '.invalid-feedback', 
                  '.text-danger', '[role="alert"]', '.help-block',
                  '.ant-form-item-explain-error', '.form-text.text-danger'
                ];
                for (const sel of errorSelectors) {
                  const errEl = parent.locator(sel);
                  const count = await errEl.count().catch(() => 0);
                  for (let i = 0; i < count; i++) {
                    const el = errEl.nth(i);
                    if (await el.isVisible().catch(() => false)) {
                      const text = (await el.innerText().catch(() => '')).trim();
                      if (text) {
                        errorMessage = text;
                        break;
                      }
                    }
                  }
                  if (errorMessage) break;
                }
              }

              let isErrorMatched = false;
              if (errorMessage) {
                isErrorMatched = compareValues(errorMessage, expectation, isContainsOperator);
              }

              if (isErrorMatched) {
                observedValue = errorMessage;
                isMatched = true;
              } else {
                const ariaValuetext = await locator.getAttribute('aria-valuetext').catch(() => null);
                const textContent = (await locator.innerText().catch(() => '')) || (await locator.textContent().catch(() => '')) || '';
                const normalVal = (ariaValuetext || textContent || '').trim();
                if (compareValues(normalVal, expectation, isContainsOperator)) {
                  observedValue = normalVal;
                  isMatched = true;
                } else {
                  observedValue = errorMessage || normalVal;
                  isMatched = false;
                }
              }
            }
          } else if (isCheckbox || isRadio || isSwitch) {
            // Checkbox/Radio/Switch: lấy trạng thái checked/unchecked
            let isChecked = false;
            const ariaChecked = await locator.getAttribute('aria-checked').catch(() => null);
            if (ariaChecked !== null) {
              isChecked = ariaChecked === 'true';
            } else {
              isChecked = await locator.isChecked().catch(() => false);
            }
            observedValue = isChecked ? 'checked' : 'unchecked';
            
            const expLower = expectation.toLowerCase();
            if (['checked', 'true', 'selected', 'yes'].includes(expLower)) {
              isMatched = isChecked;
            } else if (['unchecked', 'false', 'deselected', 'no'].includes(expLower)) {
              isMatched = !isChecked;
            } else {
              // Check theo value nếu được check
              const valueAttr = (await locator.getAttribute('value').catch(() => '')) || '';
              observedValue = isChecked ? `checked (value: ${valueAttr})` : 'unchecked';
              isMatched = isChecked && compareValues(valueAttr, expectation, isContainsOperator);
            }
          } else if (isTextbox || isSearchbox) {
            // Textbox/Searchbox: lấy nội dung đã nhập hoặc error message liên kết
            const currentVal = await locator.inputValue().catch(() => '');
            
            // Quét tìm thông báo lỗi liên kết (dành cho các test case validation lỗi)
            let errorMessage = '';
            
            // 1. Qua aria-describedby
            const ariaDescribedBy = await locator.getAttribute('aria-describedby').catch(() => null);
            if (ariaDescribedBy) {
              const ids = ariaDescribedBy.split(/\s+/);
              for (const id of ids) {
                const errEl = page.locator(`#${id}`);
                if (await errEl.count().catch(() => 0) > 0 && await errEl.isVisible().catch(() => false)) {
                  errorMessage = (await errEl.innerText().catch(() => '')).trim();
                  if (errorMessage) break;
                }
              }
            }
            
            // 2. Qua sibling/parent error container
            if (!errorMessage) {
              const parent = locator.locator('xpath=..');
              const errorSelectors = [
                '.error-message', '.error', '.invalid-feedback', 
                '.text-danger', '[role="alert"]', '.help-block',
                '.ant-form-item-explain-error', '.form-text.text-danger'
              ];
              for (const sel of errorSelectors) {
                const errEl = parent.locator(sel);
                const count = await errEl.count().catch(() => 0);
                for (let i = 0; i < count; i++) {
                  const el = errEl.nth(i);
                  if (await el.isVisible().catch(() => false)) {
                    const text = (await el.innerText().catch(() => '')).trim();
                    if (text) {
                      errorMessage = text;
                      break;
                    }
                  }
                }
                if (errorMessage) break;
              }
            }
     
            let isErrorMatched = false;
            if (errorMessage) {
              isErrorMatched = compareValues(errorMessage, expectation, isContainsOperator);
            }

            if (isErrorMatched) {
              observedValue = errorMessage;
              isMatched = true;
            } else {
              if (compareValues(currentVal, expectation, isContainsOperator)) {
                observedValue = currentVal;
                isMatched = true;
              } else {
                observedValue = errorMessage || currentVal;
                isMatched = false;
              }
            }
          } else if (isLabel || isErrorMsg || isButton || isLink || isDiv) {
            // Lấy trực tiếp văn bản hiển thị
            let textContent = '';
            const count = await locator.count().catch(() => 0);
            if (count > 1) {
              for (let i = 0; i < count; i++) {
                const el = locator.nth(i);
                const val = await el.evaluate((node) => {
                  const label = node.closest('label');
                  const targetNode = label || node;
                  return targetNode.innerText || targetNode.textContent || '';
                }).catch(() => '');
                const trimmedVal = val.trim();
                if (trimmedVal && compareValues(trimmedVal, expectation, isContainsOperator)) {
                  textContent = trimmedVal;
                  break;
                }
                if (trimmedVal && !textContent) {
                  textContent = trimmedVal;
                }
              }
            } else {
              textContent = await locator.evaluate((node) => {
                const label = node.closest('label');
                const targetNode = label || node;
                return targetNode.innerText || targetNode.textContent || '';
              }).catch(() => '');
            }

            observedValue = textContent.trim();
            isMatched = compareValues(observedValue, expectation, isContainsOperator);
          } else {
            // Fallback cho bất kỳ element nào khác: lấy text hiển thị và hỗ trợ check error con
            let textContent = '';
            const count = await locator.count().catch(() => 0);
            if (count > 1) {
              for (let i = 0; i < count; i++) {
                const el = locator.nth(i);
                const val = await el.evaluate((node) => {
                  const label = node.closest('label');
                  const targetNode = label || node;
                  return targetNode.innerText || targetNode.textContent || '';
                }).catch(() => '');
                const trimmedVal = val.trim();
                if (trimmedVal && compareValues(trimmedVal, expectation, isContainsOperator)) {
                  textContent = trimmedVal;
                  break;
                }
                if (trimmedVal && !textContent) {
                  textContent = trimmedVal;
                }
              }
            } else {
              textContent = await locator.evaluate((node) => {
                const label = node.closest('label');
                const targetNode = label || node;
                return targetNode.innerText || targetNode.textContent || '';
              }).catch(() => '');
            }
            textContent = textContent.trim();
      
            let childErrorMessage = '';
            const errorSelectors = [
              '.error-message', '.error', '.invalid-feedback', 
              '.text-danger', '[role="alert"]', '.ant-form-item-explain-error'
            ];
            for (const sel of errorSelectors) {
              const errEl = locator.first().locator(sel);
              if (await errEl.count().catch(() => 0) > 0 && await errEl.first().isVisible().catch(() => false)) {
                childErrorMessage = (await errEl.first().innerText().catch(() => '')).trim();
                break;
              }
            }
      
            let isErrorMatched = false;
            if (childErrorMessage) {
              isErrorMatched = compareValues(childErrorMessage, expectation, isContainsOperator);
            }
 
            if (isErrorMatched) {
              observedValue = childErrorMessage;
              isMatched = true;
            } else {
              if (compareValues(textContent, expectation, isContainsOperator)) {
                observedValue = textContent;
                isMatched = true;
              } else {
                observedValue = childErrorMessage || textContent;
                isMatched = false;
              }
            }
          }
        } catch (e) {
          observedValue = String(e);
          isMatched = false;
        }

        if (isMatched || (Date.now() - startTime > timeoutMs)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    if (!isMatched) {
      throw new AssertionFailedError(observedValue || 'empty', expectation || 'empty');
    }

    // Tự động chụp ảnh minh chứng thành công (PASSED)
    const checkRunId = contextData.__runId || `run_${Date.now()}`;
    const screenshotName = `check_${tcId || 'TC'}_step${step.step}_${Date.now()}.png`;
    const checkScreenshotPath = path.resolve(process.cwd(), 'reports', checkRunId, 'screenshots', screenshotName);
    const displayExpected = expectation || 'empty';
    const displayObserved = (observedValue === '' && isCheckEmpty) ? 'empty' : observedValue;
    try {
      await page.screenshot({ path: checkScreenshotPath });
      return { 
        status: 'PASSED' as const, 
        observed: displayObserved, 
        expected: displayExpected,
        screenshotPath: `screenshots/${screenshotName}` 
      };
    } catch (e) {
      console.error(`   ⚠️ Không thể chụp ảnh minh chứng cho check_value:`, e);
      return { status: 'PASSED' as const, observed: displayObserved, expected: displayExpected };
    }
  }
}

export default CheckValueAction;
