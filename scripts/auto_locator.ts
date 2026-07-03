import { chromium } from '@playwright/test';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

// Cách chạy: npx ts-node scripts/auto_locator.ts <URL> <Module_Name> <Excel_Path>
// Ví dụ: npx ts-node scripts/auto_locator.ts https://test.example.com/login LOGIN data/your-project/L3_Low_Level/1.0_Login/Master_Test_Suite_1.0_Login.xlsx

async function autoDiscoverLocators() {
  const url = process.argv[2] || 'https://test.example.com/login';
  const moduleName = process.argv[3] || 'LOGIN';
  const excelPath = process.argv[4] || 'data/your-project/L3_Low_Level/1.0_Login/Master_Test_Suite_1.0_Login.xlsx';

  console.log(`[Auto-Locator] Starting browser to scan URL: ${url}`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  console.log(`[Auto-Locator] Executing DOM Discovery Script in client context...`);
  
  // Client-side DOM scanner script
  const elements = await page.evaluate(() => {
    const interactiveTags = ['input', 'select', 'button', 'a', 'textarea'];
    const discovered: Array<{ element_id: string; locator_type: string; locator_value: string; description: string }> = [];

    // Naming prefix helpers
    const getPrefix = (el: HTMLElement): string => {
      if (el.tagName === 'INPUT') {
        const type = (el as HTMLInputElement).type.toLowerCase();
        if (type === 'checkbox') return 'chk_';
        if (type === 'radio') return 'rad_';
        return 'txt_';
      }
      if (el.tagName === 'TEXTAREA') return 'txt_';
      if (el.tagName === 'SELECT') return 'ddl_';
      if (el.tagName === 'BUTTON') return 'btn_';
      if (el.tagName === 'A') return 'lnk_';
      return 'el_';
    };

    // Main scanning loop
    interactiveTags.forEach((tagName) => {
      const els = document.querySelectorAll(tagName);
      els.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        
        // Skip hidden elements
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        let locator_type = '';
        let locator_value = '';
        let id_base = '';

        // 1. Check data-testid or other test ids
        const testId = htmlEl.getAttribute('data-testid') || htmlEl.getAttribute('data-test') || htmlEl.getAttribute('data-qa');
        if (testId) {
          locator_type = 'data-testid';
          locator_value = testId;
          id_base = testId.replace(/[-_]/g, '_');
        } 
        // 2. Check id
        else if (htmlEl.id && !htmlEl.id.startsWith('__')) {
          locator_type = 'id';
          locator_value = htmlEl.id;
          id_base = htmlEl.id.replace(/[-_]/g, '_');
        }
        // 3. Check name
        else if (htmlEl.getAttribute('name')) {
          locator_type = 'css';
          locator_value = `[name="${htmlEl.getAttribute('name')}"]`;
          id_base = htmlEl.getAttribute('name')!.replace(/[-_]/g, '_');
        }
        // 4. Check placeholder (for inputs)
        else if (htmlEl.getAttribute('placeholder')) {
          locator_type = 'css';
          locator_value = `[placeholder="${htmlEl.getAttribute('placeholder')}"]`;
          id_base = 'input_field';
        }
        // 5. Fallback to text for buttons / links
        else if (htmlEl.textContent?.trim() && htmlEl.textContent.trim().length < 30) {
          const text = htmlEl.textContent.trim();
          locator_type = 'css';
          locator_value = `${tagName}:has-text("${text}")`;
          id_base = text.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        if (locator_type && locator_value) {
          // Construct elements ID
          const prefix = getPrefix(htmlEl);
          const finalId = `${prefix}${id_base || 'el_' + index}`;

          // Attempt to get description
          const placeholder = htmlEl.getAttribute('placeholder') || '';
          const label = htmlEl.getAttribute('aria-label') || '';
          const text = htmlEl.textContent?.trim().substring(0, 30) || '';
          const description = placeholder || label || text || `Element ${finalId}`;

          discovered.push({
            element_id: finalId,
            locator_type,
            locator_value,
            description
          });
        }
      });
    });

    return discovered;
  });

  await browser.close();
  console.log(`[Auto-Locator] Scanning finished. Discovered ${elements.length} elements.`);

  // Write results directly to L3 Excel
  if (fs.existsSync(excelPath)) {
    console.log(`[Auto-Locator] Writing to Excel sheet: ELEMENT_${moduleName} inside ${excelPath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const sheetName = `ELEMENT_${moduleName.toUpperCase()}`;
    let ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      ws = workbook.addWorksheet(sheetName);
      ws.addRow(['element_id', 'locator_type', 'locator_value']);
    } else {
      // Clear rows below header
      if (ws.rowCount > 1) {
        ws.spliceRows(2, ws.rowCount - 1);
      }
    }

    elements.forEach(el => {
      ws.addRow([el.element_id, el.locator_type, el.locator_value]);
      console.log(`  Added: ${el.element_id} -> [${el.locator_type}] ${el.locator_value}`);
    });

    await workbook.xlsx.writeFile(excelPath);
    console.log(`[Auto-Locator] Excel updated successfully!`);
  } else {
    console.warn(`[Auto-Locator] Excel file not found at: ${excelPath}. Printing discovered elements instead:\n`, elements);
  }
}

autoDiscoverLocators().catch(console.error);
