import { ElementConfig } from '../types';

export class LocatorResolver {
  private elementsMap: Map<string, ElementConfig>;

  constructor(elementsList: ElementConfig[]) {
    this.elementsMap = new Map();
    elementsList.forEach(el => {
      this.elementsMap.set(el.element_id, el);
    });
  }

  /**
   * Định vị locator tương ứng của target ID.
   * Hỗ trợ tự động thay thế ${data} trong locator_value nếu có truyền dynamicValue.
   * @param target ID của element trong ELEMENT sheet (hoặc locator viết inline)
   * @param dynamicValue Giá trị động dùng để thay thế ${data}
   */
  resolve(target: string, dynamicValue?: string): string | null {
    if (!target) return null;

    const element = this.elementsMap.get(target);
    let locatorValue = element ? element.locator_value : target;
    const locatorType = element ? element.locator_type : 'xpath'; // Mặc định xpath nếu viết inline

    // Tự động unescape các ký tự thực thể HTML/XML phổ biến để tránh SyntaxError
    if (locatorValue) {
      locatorValue = locatorValue
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }

    // Thay thế tham số động trong xpath/css: e.g. //div[text()='${data}']
    if (dynamicValue && locatorValue.includes('${data}')) {
      locatorValue = locatorValue.replace(/\${data}/g, dynamicValue);
    }

    // Playwright selector engines:
    // https://playwright.dev/docs/selectors
    switch (locatorType.toLowerCase()) {
      case 'data-testid':
        return `[data-testid="${locatorValue}"]`;
      case 'id':
        return `id=${locatorValue}`;
      case 'role':
        // Ví dụ: role=button[name="Submit"]
        return locatorValue;
      case 'text': {
        // Sử dụng substring match để hỗ trợ các element chứa thẻ con (như svg, asterisk *) hoặc whitespace thừa
        return `text=${locatorValue}`;
      }
      case 'placeholder':
        return `input[placeholder*="${locatorValue}"], textarea[placeholder*="${locatorValue}"]`;
      case 'label':
        return `label:has-text("${locatorValue}") >> input, label:has-text("${locatorValue}") >> textarea`;
      case 'css':
        return locatorValue;
      case 'xpath':
        return `xpath=${locatorValue}`;
      default:
        // Nếu locator_type không khớp cái nào, trả về locatorValue nguyên bản
        return locatorValue;
    }
  }
}
export default LocatorResolver;
