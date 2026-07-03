import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { ExcelReader } from '../src/core/ExcelReader';
import { LocatorResolver } from '../src/core/LocatorResolver';
import { appConfig } from '../src/core/ConfigLoader';

const VALID_ENVS = ['local', 'test', 'sit', 'uat', 'dev', 'prod'];

/**
 * Quét đệ quy tìm các file .xlsx trong thư mục data/
 */
function findExcelFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (['L1_High_Level', 'L2_Mid_Level', 'High_Level_2_TC', 'assets', 'data_common', '_common', '_templates', 'common'].includes(file)) {
        continue;
      }
      findExcelFiles(filePath, fileList);
    } else if (file.endsWith('.xlsx') && !file.startsWith('~$') && file !== 'Global_config.xlsx' && file !== 'preconditions.xlsx') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Tìm file Excel dựa trên từ khóa hoặc đường dẫn
 */
function resolveExcelPath(input: string): string {
  const directPath = path.resolve(process.cwd(), input);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }
  
  const directPathWithExt = path.resolve(process.cwd(), input.endsWith('.xlsx') ? input : input + '.xlsx');
  if (fs.existsSync(directPathWithExt) && fs.statSync(directPathWithExt).isFile()) {
    return directPathWithExt;
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  const allFiles = findExcelFiles(dataDir);
  const cleanInput = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const matches = allFiles.filter(filePath => {
    const filename = path.basename(filePath, '.xlsx').toLowerCase().replace(/[^a-z0-9]/g, '');
    return filename.includes(cleanInput) || cleanInput.includes(filename);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    console.error(`❌ Lỗi: Tìm thấy nhiều file Excel khớp với từ khóa "${input}":`);
    matches.forEach(m => console.error(`   - ${path.relative(process.cwd(), m)}`));
    process.exit(1);
  }

  console.error(`❌ Lỗi: Không tìm thấy file Excel nào khớp với từ khóa "${input}".`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  let rawFile: string | undefined = undefined;
  let url: string | undefined = undefined;
  let testEnv: string | undefined = undefined;
  let moduleName: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--file=')) rawFile = arg.split('=')[1];
    else if (arg === '-f' || arg === '--file') rawFile = args[++i];
    else if (arg.startsWith('--url=')) url = arg.split('=')[1];
    else if (arg === '-u' || arg === '--url') url = args[++i];
    else if (arg.startsWith('--env=')) testEnv = arg.split('=')[1];
    else if (arg === '-e' || arg === '--env') testEnv = args[++i];
    else if (arg.startsWith('--module=')) moduleName = arg.split('=')[1];
    else if (arg === '-m' || arg === '--module') moduleName = args[++i];
    else {
      const lowerArg = arg.toLowerCase();
      if (VALID_ENVS.includes(lowerArg)) testEnv = lowerArg;
      else if (arg.startsWith('http')) url = arg;
      else if (arg.endsWith('.xlsx')) rawFile = arg;
      else if (!rawFile) rawFile = arg;
      else if (!moduleName) moduleName = arg;
    }
  }

  if (!rawFile) {
    console.error('❌ Lỗi: Thiếu file kịch bản Excel Master L3. Ví dụ: npx ts-node scripts/extract_dropdown_options.ts 9.1.2 --url http://url');
    process.exit(1);
  }

  const excelPath = resolveExcelPath(rawFile);
  const finalEnv = (testEnv || appConfig.currentEnv || 'test').toLowerCase();
  
  // Rút gọn tên module để map với tên sheet
  const filename = path.basename(excelPath, '.xlsx');
  const cleanModuleName = moduleName || filename.replace(/^master_test_suite_/i, '').replace(/^\d+(\.\d+)*_/i, '');
  const moduleCleanName = cleanModuleName.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

  // Xác định URL đích
  let finalUrl = url;
  if (!finalUrl) {
    // Thử đọc URL của module từ sheet PAGE trong Excel
    try {
      const reader = new ExcelReader(excelPath);
      const pages = await reader.readPages();
      const pagesMap = new Map(pages.map(p => [p.page_key.toLowerCase(), p.url]));
      
      // Tìm URL tương ứng với module
      const pageKey = `page_${moduleCleanName.toLowerCase()}`;
      const relativeUrl = pagesMap.get(pageKey) || pagesMap.get(moduleCleanName.toLowerCase());
      
      if (relativeUrl) {
        const base = appConfig.project.base_url[finalEnv] || 'https://test.example.com';
        finalUrl = relativeUrl.startsWith('http') ? relativeUrl : `${base}${relativeUrl}`;
      }
    } catch (e) {}
  }

  if (!finalUrl) {
    console.error('❌ Lỗi: Không xác định được URL đích. Vui lòng truyền tham số --url <URL>');
    process.exit(1);
  }

  console.log(`🎬 [Dropdown Discovery] Bắt đầu tự động quét dropdown options...`);
  console.log(`   📂 File Excel Master L3: ${path.basename(excelPath)}`);
  console.log(`   📦 Module tương ứng:    ${moduleCleanName}`);
  console.log(`   🌐 Môi trường:          ${finalEnv.toUpperCase()}`);
  console.log(`   🔗 URL Quét:            ${finalUrl}`);

  // 1. Đọc danh sách Elements trong Excel Master
  const reader = new ExcelReader(excelPath);
  let elements = [];
  try {
    elements = await reader.readElements(moduleCleanName);
  } catch (err: any) {
    console.error(`❌ Lỗi khi đọc sheet ELEMENT_${moduleCleanName}:`, err.message);
    process.exit(1);
  }

  // Lọc lấy các dropdown elements (ID bắt đầu bằng ddl_ hoặc select_)
  const dropdownElements = elements.filter(el => 
    el.element_id.startsWith('ddl_') || el.element_id.startsWith('select_')
  );

  if (dropdownElements.length === 0) {
    console.log(`⚠️ Không tìm thấy element dropdown nào (prefix ddl_ hoặc select_) trong sheet ELEMENT_${moduleCleanName}. Kết thúc.`);
    process.exit(0);
  }

  console.log(`   🔎 Tìm thấy ${dropdownElements.length} dropdown elements trong sheet ELEMENT. Tiến hành quét UI...`);

  // 2. Khởi chạy trình duyệt Playwright
  const storageStatePath = path.resolve(process.cwd(), '.run/storage-state.json');
  const browser = await chromium.launch({ headless: false }); // Headed mode để Tester quan sát được
  const context = await browser.newContext({
    storageState: fs.existsSync(storageStatePath) ? storageStatePath : undefined,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const locatorResolver = new LocatorResolver(elements);

  try {
    await page.goto(finalUrl);
    await page.waitForLoadState('load');
    // Đợi thêm một chút để trang ổn định
    await page.waitForTimeout(2000);

    const optionsMap: Record<string, string[]> = {};

    for (const el of dropdownElements) {
      const selector = locatorResolver.resolve(el.element_id);
      if (!selector) continue;

      const dropdownLocator = page.locator(selector).first();
      const isVisible = await dropdownLocator.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isVisible) {
        console.log(`   ⏩ Bỏ qua ${el.element_id} (phần tử không hiển thị trên giao diện hiện tại).`);
        continue;
      }

      console.log(`   👉 Đang quét dropdown: [${el.element_id}]`);
      
      // Click để mở dropdown
      await dropdownLocator.click();
      await page.waitForTimeout(600); // Chờ menu dropdown render xong

      // Các selector phổ biến của option item (AntD, bootstrap, custom role=option)
      const optionItemSelectors = [
        '.ant-select-item-option-content',
        '.ant-select-item-option',
        'div[role="option"]',
        'li[role="option"]',
        '.select-option',
        '[role="option"]'
      ];

      let optionsLocator = null;
      for (const sel of optionItemSelectors) {
        const loc = page.locator(sel);
        const count = await loc.count().catch(() => 0);
        if (count > 0) {
          optionsLocator = loc;
          break;
        }
      }

      if (optionsLocator) {
        const count = await optionsLocator.count();
        const optionsList: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await optionsLocator.nth(i).innerText().catch(() => '');
          const cleanText = text.trim();
          if (cleanText && !optionsList.includes(cleanText)) {
            optionsList.push(cleanText);
          }
        }
        optionsMap[el.element_id] = optionsList;
        console.log(`      Found ${optionsList.length} options. Ví dụ: ${optionsList.slice(0, 3).join(', ')}...`);
      } else {
        console.warn(`      ⚠️ Không phát hiện phần tử option nào hiển thị trên UI.`);
      }

      // Đóng dropdown bằng phím Escape hoặc click vào chính nó để không làm hỏng UI
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 3. Ghi dữ liệu vào file JSON cấu hình tập trung
    if (Object.keys(optionsMap).length > 0) {
      const projectDir = appConfig.project.project_name || 'Tiem_Chung';
      const jsonDir = path.resolve(process.cwd(), 'config/env_data', projectDir);
      
      if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }

      // Tên file JSON khớp với tên file Excel (rút gọn) để AI dễ đọc
      const jsonFilename = filename.replace(/^master_test_suite_/i, '');
      const jsonPath = path.join(jsonDir, `${jsonFilename}.json`);

      let configJson: Record<string, any> = {};
      if (fs.existsSync(jsonPath)) {
        try {
          configJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        } catch (e) {
          configJson = {};
        }
      }

      const envKey = finalEnv.toUpperCase();
      configJson[envKey] = {
        ...(configJson[envKey] || {}),
        ...optionsMap
      };

      fs.writeFileSync(jsonPath, JSON.stringify(configJson, null, 2), 'utf-8');
      console.log(`\n✅ Thành công: Đã ghi và đồng bộ cấu hình dropdown cho môi trường [${envKey}] vào file:`);
      console.log(`   📄 ${path.relative(process.cwd(), jsonPath)}`);
    } else {
      console.log('⚠️ Không thu thập được dữ liệu dropdown nào.');
    }

  } catch (err: any) {
    console.error('❌ Lỗi trong quá trình quét UI:', err.message);
  } finally {
    await browser.close();
    console.log('🏁 [Dropdown Discovery] Đã hoàn thành và đóng trình duyệt.');
  }
}

main().catch(err => {
  console.error('❌ Lỗi hệ thống:', err);
});
