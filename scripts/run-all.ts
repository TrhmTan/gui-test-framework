import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════════════════════
// run-all.ts — Batch Parallel Runner
// Chạy song song tất cả file Excel test case trong một folder.
//
// Cách dùng:
//   npx ts-node scripts/run-all.ts [folder] [env] [--headed] [--workers=N]
//
// Ví dụ:
//   npx ts-node scripts/run-all.ts                          → chạy tất cả file trong data/
//   npx ts-node scripts/run-all.ts L3_Low_Level local  → chạy file trong folder L3
//   npx ts-node scripts/run-all.ts L3_Low_Level test --headed
//   npx ts-node scripts/run-all.ts L3_Low_Level uat --workers=3
// ═══════════════════════════════════════════════════════════════

const VALID_ENVS = ['local', 'test', 'sit', 'uat', 'dev', 'prod'];

// Các folder cần bỏ qua khi quét
const IGNORED_FOLDERS = [
  'L1_High_Level',
  'L2_Mid_Level',
  'High_Level_2_TC',
  'assets',
  'data_common',
  '_common',
  '_templates',
];

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Quét đệ quy tìm tất cả file .xlsx trong thư mục chỉ định
 */
function findExcelFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!IGNORED_FOLDERS.includes(entry)) {
        findExcelFiles(fullPath, fileList);
      }
    } else if (
      entry.endsWith('.xlsx') &&
      !entry.startsWith('~$') &&
      entry !== 'Global_config.xlsx' &&
      entry !== 'preconditions.xlsx'
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Tìm thư mục theo keyword (fuzzy match trong data/)
 */
function resolveTargetDir(input: string): string {
  const dataDir = path.resolve(process.cwd(), 'data');

  // Thử đường dẫn trực tiếp (absolute hoặc relative từ cwd)
  const directPath = path.resolve(process.cwd(), input);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    return directPath;
  }

  // Thử tìm folder trong data/ bằng fuzzy match
  const cleanInput = input.toLowerCase().replace(/[^a-z0-9]/g, '');

  function searchDir(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir)) {
      if (IGNORED_FOLDERS.includes(entry)) continue;
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        const cleanName = entry.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanName.includes(cleanInput) || cleanInput.includes(cleanName)) {
          return fullPath;
        }
        const nested = searchDir(fullPath);
        if (nested) return nested;
      }
    }
    return null;
  }

  const found = searchDir(dataDir);
  if (found) return found;

  console.error(`❌ Không tìm thấy folder khớp với "${input}" trong data/.`);
  process.exit(1);
}

/**
 * Chạy một file Excel bằng run-test.ts, trả về Promise khi hoàn thành
 */
function runExcelFile(
  excelPath: string,
  env: string,
  extraArgs: string[],
  workerIndex: number,
  totalWorkers: number,
  disableOriginalWrite: boolean
): Promise<{ file: string; env: string; code: number }> {
  return new Promise((resolve) => {
    const relativePath = path.relative(process.cwd(), excelPath);
    const filename = path.basename(excelPath);

    // Tạo slug từ tên file + env để dùng làm RUN_ID_PREFIX unique cho mỗi process
    const fileSlug = `${path.basename(excelPath, '.xlsx')}_${env}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 30);

    const args = [
      'ts-node',
      'scripts/run-test.ts',
      '--file', excelPath,
      '--env', env,
      ...extraArgs,
    ];

    const label = `[Worker ${workerIndex + 1}/${totalWorkers}] ${filename} (ENV: ${env.toUpperCase()})`;
    console.log(`\n🚀 ${label}`);
    console.log(`   📂 ${relativePath}`);
    console.log(`   🌐 ENV: ${env.toUpperCase()}`);

    // Tạo thư mục và file log riêng cho worker này
    const logDir = path.resolve(process.cwd(), 'reports/logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFilePath = path.join(logDir, `${fileSlug}.log`);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });
    
    console.log(`   📝 File log: reports/logs/${fileSlug}.log`);

    const child = spawn('npx', args, {
      env: {
        ...process.env,
        RUN_ID_PREFIX: fileSlug,
        DISABLE_ORIGINAL_EXCEL_WRITE: disableOriginalWrite ? 'true' : 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'], // Sử dụng pipe để bắt log
      shell: true,
    });

    let stdoutBuffer = '';
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const cleanLine = line.replace(/\r/g, '');
        logStream.write(cleanLine + '\n');
        console.log(`\x1b[36m[Worker ${workerIndex + 1}][${filename}]\x1b[0m ${cleanLine}`);
      }
    });

    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';
      for (const line of lines) {
        const cleanLine = line.replace(/\r/g, '');
        logStream.write('[ERROR] ' + cleanLine + '\n');
        console.error(`\x1b[31m[Worker ${workerIndex + 1}][${filename}][ERR]\x1b[0m ${cleanLine}`);
      }
    });

    child.on('exit', (code) => {
      // In nốt buffer còn dư nếu có
      if (stdoutBuffer.trim()) {
        const cleanLine = stdoutBuffer.replace(/\r/g, '');
        logStream.write(cleanLine + '\n');
        console.log(`\x1b[36m[Worker ${workerIndex + 1}][${filename}]\x1b[0m ${cleanLine}`);
      }
      if (stderrBuffer.trim()) {
        const cleanLine = stderrBuffer.replace(/\r/g, '');
        logStream.write('[ERROR] ' + cleanLine + '\n');
        console.error(`\x1b[31m[Worker ${workerIndex + 1}][${filename}][ERR]\x1b[0m ${cleanLine}`);
      }
      
      logStream.end();

      const exitCode = code ?? 1;
      if (exitCode === 0) {
        console.log(`\n\x1b[32m✅ PASS: ${filename} (ENV: ${env.toUpperCase()})\x1b[0m`);
      } else {
        console.log(`\n\x1b[31m❌ FAIL (exit ${exitCode}): ${filename} (ENV: ${env.toUpperCase()})\x1b[0m`);
      }
      resolve({ file: filename, env, code: exitCode });
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let folderInput: string | undefined;
  let envInput = 'local';
  let maxWorkers = 0; // 0 = không giới hạn (chạy tất cả song song)
  const extraArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--workers=')) {
      maxWorkers = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--workers' || arg === '-w') {
      maxWorkers = parseInt(args[++i], 10);
    } else if (arg.startsWith('--env=')) {
      envInput = arg.split('=')[1];
    } else if (arg === '--env' || arg === '-e') {
      envInput = args[++i];
    } else if (arg.startsWith('-')) {
      // Chuyển tiếp các flag khác cho Playwright (--headed, --project, v.v.)
      extraArgs.push(arg);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        extraArgs.push(args[++i]);
      }
    } else {
      // Positional: env hoặc folder
      const lower = arg.toLowerCase();
      const parts = lower.split(',');
      const allPartsAreEnvs = parts.every((part) => VALID_ENVS.includes(part.trim()));
      if (allPartsAreEnvs) {
        envInput = lower;
      } else {
        folderInput = arg;
      }
    }
  }

  // Phân tích danh sách envs
  const envs = envInput
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (envs.length === 0) {
    envs.push('local');
  }

  // Xác định thư mục chứa file Excel
  const targetDir = folderInput
    ? resolveTargetDir(folderInput)
    : path.resolve(process.cwd(), 'data');

  const relativeDir = path.relative(process.cwd(), targetDir);
  const excelFiles = findExcelFiles(targetDir);

  if (excelFiles.length === 0) {
    console.error(`❌ Không tìm thấy file Excel nào trong: ${relativeDir}`);
    process.exit(1);
  }

  // Tạo danh sách các task cần chạy (kết hợp các file Excel với các môi trường)
  const tasks: { file: string; env: string }[] = [];
  for (const env of envs) {
    for (const file of excelFiles) {
      tasks.push({ file, env });
    }
  }

  // Tự động tắt tính năng ghi đè file Excel gốc nếu chạy trên nhiều hơn 1 môi trường để tránh tranh chấp I/O
  const disableOriginalWrite = envs.length > 1;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🗂️  Batch Parallel Runner`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`📁 Folder:     ${relativeDir}`);
  console.log(`🌐 ENVs:       ${envs.map((e) => e.toUpperCase()).join(', ')}`);
  console.log(
    `⚙️  Workers:   ${maxWorkers > 0 ? maxWorkers : 'Không giới hạn (tất cả song song)'}`
  );
  console.log(`📋 Tổng số tasks: ${tasks.length}`);
  tasks.forEach((t, i) => {
    console.log(`   ${i + 1}. ${path.relative(process.cwd(), t.file)} [${t.env.toUpperCase()}]`);
  });
  console.log(`${'─'.repeat(60)}\n`);

  const startTime = Date.now();
  const results: { file: string; env: string; code: number }[] = [];

  if (maxWorkers <= 0 || maxWorkers >= tasks.length) {
    // Chạy tất cả song song cùng lúc
    console.log(`⚡ Chạy song song tất cả ${tasks.length} tasks...\n`);
    const promises = tasks.map((t, i) =>
      runExcelFile(t.file, t.env, extraArgs, i, tasks.length, disableOriginalWrite)
    );
    const allResults = await Promise.all(promises);
    results.push(...allResults);
  } else {
    // Chạy theo nhóm (batch) với giới hạn số worker
    console.log(`⚡ Chạy theo batch, tối đa ${maxWorkers} worker song song...\n`);
    for (let i = 0; i < tasks.length; i += maxWorkers) {
      const batch = tasks.slice(i, i + maxWorkers);
      const batchNum = Math.floor(i / maxWorkers) + 1;
      const totalBatches = Math.ceil(tasks.length / maxWorkers);
      console.log(`\n📦 Batch ${batchNum}/${totalBatches}: chạy ${batch.length} tasks`);

      const batchPromises = batch.map((t, j) =>
        runExcelFile(t.file, t.env, extraArgs, i + j, tasks.length, disableOriginalWrite)
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
  }

  // ── Tổng kết ─────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter((r) => r.code === 0);
  const failed = results.filter((r) => r.code !== 0);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 KẾT QUẢ BATCH RUN`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`⏱️  Thời gian tổng: ${elapsed}s`);
  console.log(`✅ PASS: ${passed.length}/${results.length} tasks`);
  console.log(`❌ FAIL: ${failed.length}/${results.length} tasks`);

  if (failed.length > 0) {
    console.log(`\n❌ Danh sách task thất bại:`);
    failed.forEach((r) => console.log(`   - ${r.file} [${r.env.toUpperCase()}]`));
  }

  console.log(`${'═'.repeat(60)}\n`);

  // Exit code: 0 nếu tất cả pass, 1 nếu có bất kỳ fail
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Lỗi không mong muốn:', err);
  process.exit(1);
});

