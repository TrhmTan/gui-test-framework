import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { appConfig } from '../src/core/ConfigLoader';

const VALID_ENVS = ['local', 'test', 'sit', 'uat', 'dev', 'prod'];
const VALID_MODES = ['element', 'verify', 'test', 'run'];

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
      // Bỏ qua thư mục chứa kịch bản mức cao đầu vào, templates, assets, và các folder cũ
      if (file !== 'L1_High_Level' && file !== 'L2_Mid_Level' && file !== 'High_Level_2_TC' && file !== 'assets' && file !== 'data_common' && file !== '_common' && file !== '_templates' && file !== 'common') {
        findExcelFiles(filePath, fileList);
      }
    } else if (file.endsWith('.xlsx') && !file.startsWith('~$') && file !== 'Global_config.xlsx' && file !== 'preconditions.xlsx') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Tìm kiếm file Excel thông minh dựa trên đường dẫn hoặc từ khóa tìm kiếm (fuzzy/substring)
 */
function resolveExcelPath(input: string): string {
  // 1. Kiểm tra xem có phải đường dẫn trực tiếp chính xác không
  const directPath = path.resolve(process.cwd(), input);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }
  
  // Thử thêm đuôi .xlsx nếu chưa có
  const directPathWithExt = path.resolve(process.cwd(), input.endsWith('.xlsx') ? input : input + '.xlsx');
  if (fs.existsSync(directPathWithExt) && fs.statSync(directPathWithExt).isFile()) {
    return directPathWithExt;
  }

  // 2. Tìm kiếm thông minh trong thư mục data/
  const dataDir = path.resolve(process.cwd(), 'data');
  const allFiles = findExcelFiles(dataDir);
  
  // Chuẩn hóa chuỗi tìm kiếm: chuyển chữ thường, loại bỏ ký tự đặc biệt
  const cleanInput = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const matches = allFiles.filter(filePath => {
    const filename = path.basename(filePath, '.xlsx').toLowerCase().replace(/[^a-z0-9]/g, '');
    return filename.includes(cleanInput) || cleanInput.includes(filename);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    const relativeMatches = matches.map(p => path.relative(process.cwd(), p));
    console.error(`❌ Lỗi: Tìm thấy nhiều file Excel khớp với từ khóa "${input}":`);
    relativeMatches.forEach(m => console.error(`   - ${m}`));
    console.error(`👉 Vui lòng nhập từ khóa cụ thể hơn.`);
    process.exit(1);
  }

  console.error(`❌ Lỗi: Không tìm thấy file Excel nào khớp với từ khóa "${input}" trong thư mục data/.`);
  process.exit(1);
}

function run() {
  const args = process.argv.slice(2);
  
  let rawFile: string | undefined = undefined;
  let moduleFilter: string | undefined = undefined;
  let testEnv: string | undefined = undefined;
  let mode: string | undefined = undefined;
  
  const freeKeywords: string[] = [];
  const forwardedArgs: string[] = [];

  // Phân tích tham số không phụ thuộc vị trí
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Xử lý các cờ CLI runner
    if (arg.startsWith('--file=')) {
      rawFile = arg.split('=')[1];
    } else if (arg === '-f' || arg === '--file') {
      rawFile = args[++i];
    } else if (arg.startsWith('--module=')) {
      moduleFilter = arg.split('=')[1];
    } else if (arg === '-m' || arg === '--module') {
      moduleFilter = args[++i];
    } else if (arg.startsWith('--env=')) {
      testEnv = arg.split('=')[1];
    } else if (arg === '-e' || arg === '--env') {
      testEnv = args[++i];
    } else if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1];
    } else if (arg === '--mode') {
      mode = args[++i];
    } else if (arg.startsWith('-')) {
      // Các flag chuyển tiếp cho Playwright (như --project, --headed, etc.)
      forwardedArgs.push(arg);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        forwardedArgs.push(args[++i]);
      }
    } else {
      // Đối số tự do (positional argument)
      const lowerArg = arg.toLowerCase();
      if (VALID_MODES.includes(lowerArg)) {
        mode = lowerArg;
      } else if (VALID_ENVS.includes(lowerArg)) {
        testEnv = lowerArg;
      } else if (arg.endsWith('.xlsx')) {
        rawFile = arg;
      } else {
        freeKeywords.push(arg);
      }
    }
  }

  // Khớp file và module từ từ khóa tự do
  let excelPath = '';
  if (rawFile) {
    excelPath = resolveExcelPath(rawFile);
  } else if (freeKeywords.length > 0) {
    const fileKeyword = freeKeywords.shift()!;
    excelPath = resolveExcelPath(fileKeyword);
  } else {
    console.error('❌ Lỗi: Thiếu thông tin file kịch bản. Ví dụ: .\\run do_chi_so local');
    process.exit(1);
  }

  // Xác định module filter
  if (!moduleFilter) {
    if (freeKeywords.length > 0) {
      moduleFilter = freeKeywords.shift();
    } else {
      const filename = path.basename(excelPath, '.xlsx');
      const cleanFilter = filename.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      // Nếu là file Master chứa nhiều module và không chỉ định rõ module, mặc định để trống chạy tất cả
      if (!cleanFilter.startsWith('master_test_suite') && !cleanFilter.startsWith('test_cases_common') && !cleanFilter.startsWith('test_cases_')) {
        moduleFilter = cleanFilter;
      }
    }
  }

  // Xác định môi trường chạy (TEST_ENV)
  const finalEnv = testEnv || appConfig.currentEnv;

  // Xác định chế độ chạy (Mode)
  const finalMode = mode || 'test';
  const isElementMode = finalMode === 'element' || finalMode === 'verify';

  // Cấu hình spec file chạy tương ứng
  const specFile = isElementMode ? 'tests/verify-elements.spec.ts' : 'tests/main.spec.ts';

  const relativeExcelPath = path.relative(process.cwd(), excelPath);

  console.log(`🚀 [CLI Runner] Đang chuẩn bị chạy test...`);
  console.log(`   📂 File Excel:   ${relativeExcelPath}`);
  console.log(`   📦 Module Filter: ${moduleFilter || 'ALL (Master Suite)'}`);
  console.log(`   🌐 Môi trường:   ${finalEnv.toUpperCase()}`);
  console.log(`   ⚙️ Chế độ chạy:   ${isElementMode ? 'B1 - QUÉT ELEMENT (Verify)' : 'B2 - CHẠY TEST CASE (Execution)'}`);

  const env = {
    ...process.env,
    EXCEL_PATH: excelPath,
    MODULE_FILTER: moduleFilter || '',
    TEST_ENV: finalEnv
  };

  // Thiết lập lệnh Playwright thực thi
  const playwrightArgs = [
    'playwright',
    'test',
    specFile
  ];

  // Nếu cấu hình HEADLESS là false, mặc định chạy có giao diện
  if (!appConfig.isHeadless) {
    playwrightArgs.push('--headed');
  }

  // Chuyển tiếp các đối số tùy chỉnh khác
  forwardedArgs.forEach(arg => {
    if (!playwrightArgs.includes(arg)) {
      playwrightArgs.push(arg);
    }
  });

  console.log(`   💻 Thực thi: npx ${playwrightArgs.join(' ')}\n`);

  const child = spawn('npx', playwrightArgs, {
    env,
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    // Tự động gọi script sinh báo cáo kết quả chạy test
    try {
      console.log(`\n📊 [Reporter] Đang tự động tạo báo cáo tóm tắt kết quả...`);
      const { execSync } = require('child_process');
      execSync('npx ts-node scripts/generate-summary-report.ts', { stdio: 'inherit' });
    } catch (reportErr: any) {
      console.error(`⚠️ [Reporter] Lỗi khi tạo báo cáo tóm tắt:`, reportErr.message);
    }
    process.exit(code || 0);
  });
}

run();


