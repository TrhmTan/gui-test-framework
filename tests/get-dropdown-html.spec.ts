import { test, chromium } from '@playwright/test';
import * as path from 'path';

test('Get room dropdown HTML', async () => {
  const browser = await chromium.launch({ headless: true });
  const storageStatePath = path.resolve(process.cwd(), '.run/storage-state.json');
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  
  await page.goto('https://test.example.com/vaccination/screening-doctor');
  await page.waitForTimeout(5000);
  
  // Take snapshot of container around the dropdown
  // Let's print the outerHTML of body or search for element containing "Phòng khám"
  const html = await page.evaluate(() => {
    // Find element with text "Chọn phòng đang ngồi" or similar
    const elements = Array.from(document.querySelectorAll('*'));
    const dropdown = elements.find(el => el.textContent && el.textContent.includes('Chọn phòng đang ngồi'));
    if (dropdown) {
      // Find its closest parent or the element itself
      return dropdown.outerHTML;
    }
    return document.body.innerHTML;
  });
  
  console.log("=== DROPDOWN / BODY HTML ===");
  console.log(html.substring(0, 5000)); // limit output
  await browser.close();
});
