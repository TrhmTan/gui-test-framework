import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

interface TestCaseInfo {
  id: string;
  summary: string;
  status: 'PASSED' | 'FAILED' | 'NOT_RUN';
  failedSteps: {
    step: string;
    action: string;
    target: string;
    value: string;
    expected: string;
    observed: string;
    result: string;
  }[];
}

interface FailurePattern {
  errorMessage: string;
  cases: { id: string; summary: string }[];
}

async function main() {
  // 1. Xác định đường dẫn file Excel kết quả và thư mục lưu báo cáo
  let excelPath = '';
  let reportDir = '';

  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Nếu truyền đường dẫn file Excel trực tiếp qua dòng lệnh
    excelPath = path.resolve(process.cwd(), args[0]);
    reportDir = path.dirname(excelPath);
  } else {
    // Mặc định đọc từ active_run_info.json
    const runInfoPath = path.resolve(process.cwd(), '.run/active_run_info.json');
    if (fs.existsSync(runInfoPath)) {
      try {
        const runInfo = JSON.parse(fs.readFileSync(runInfoPath, 'utf-8'));
        excelPath = runInfo.resultExcelPath;
        reportDir = runInfo.runReportDir;
      } catch (e: any) {
        console.error(`❌ Lỗi đọc file .run/active_run_info.json: ${e.message}`);
        process.exit(1);
      }
    }
  }

  if (!excelPath || !fs.existsSync(excelPath)) {
    console.error(`❌ Lỗi: Không tìm thấy file Excel kết quả tại: "${excelPath || 'N/A'}"`);
    process.exit(1);
  }

  console.log(`📊 [Reporter] Đang phân tích kết quả từ file: ${path.basename(excelPath)}...`);

  // 2. Mở file Excel
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  // Tìm tất cả các sheet TEST_CASE_*
  const tcSheets = workbook.worksheets.filter(sheet => sheet.name.startsWith('TEST_CASE_'));
  if (tcSheets.length === 0) {
    console.error(`❌ Lỗi: Không tìm thấy sheet TEST_CASE_* nào trong file Excel kết quả.`);
    process.exit(1);
  }

  const testCases: { [id: string]: TestCaseInfo } = {};

  for (const sheet of tcSheets) {
    // Xác định cột dựa trên dòng header (dòng 1)
    let llTcIdCol = 5; // Mặc định cột E
    let summaryCol = 7; // Mặc định cột G
    let stepCol = 11; // Mặc định cột K
    let actionCol = 12; // Mặc định cột L
    let targetCol = 13; // Mặc định cột M
    let valueCol = 14; // Mặc định cột N
    let expectedCol = 15; // Mặc định cột O
    let observedCol = 16; // Mặc định cột P
    let resultCol = 17; // Mặc định cột Q

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const text = cell.text.trim().toLowerCase();
      if (text === 'll_tc_id' || text === 'tc_id') llTcIdCol = colNumber;
      else if (text === 'summary') summaryCol = colNumber;
      else if (text === 'step') stepCol = colNumber;
      else if (text === 'action') actionCol = colNumber;
      else if (text === 'target') targetCol = colNumber;
      else if (text === 'value') valueCol = colNumber;
      else if (text === 'expected') expectedCol = colNumber;
      else if (text === '[o]_observed') observedCol = colNumber;
      else if (text === '[o]_test_result') resultCol = colNumber;
    });

    let currentTcId = '';

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header

      const tcId = row.getCell(llTcIdCol).text.trim();
      const summary = row.getCell(summaryCol).text.trim();
      const step = row.getCell(stepCol).text.trim();
      const action = row.getCell(actionCol).text.trim();
      const target = row.getCell(targetCol).text.trim();
      const value = row.getCell(valueCol).text.trim();
      const expected = row.getCell(expectedCol).text.trim();
      const observed = row.getCell(observedCol).text.trim();
      const result = row.getCell(resultCol).text.trim();

      if (tcId) {
        currentTcId = tcId;
        testCases[currentTcId] = {
          id: currentTcId,
          summary: summary,
          // Mặc định NOT_RUN — chỉ chuyển PASSED khi có ít nhất 1 step có kết quả thực.
          // Tránh false positive: TC fail ở precondition (chưa ghi kết quả nào) hoặc TC
          // đang OFF từng bị đếm nhầm là PASS.
          status: 'NOT_RUN',
          failedSteps: []
        };
      }

      if (currentTcId && action) {
        if (result && !result.toUpperCase().startsWith('FAIL') && testCases[currentTcId].status === 'NOT_RUN') {
          testCases[currentTcId].status = 'PASSED';
        }
        if (result.toUpperCase().startsWith('FAIL')) {
          testCases[currentTcId].status = 'FAILED';
          testCases[currentTcId].failedSteps.push({
            step,
            action,
            target,
            value,
            expected,
            observed,
            result
          });
        }
      }
    });
  }

  // 3. Tổng hợp số liệu
  let totalCases = 0;
  let passCases = 0;
  let failCases = 0;
  let notRunCases = 0;
  const failedCasesList: TestCaseInfo[] = [];
  const notRunCasesList: TestCaseInfo[] = [];

  for (const tc of Object.values(testCases)) {
    totalCases++;
    if (tc.status === 'FAILED') {
      failCases++;
      failedCasesList.push(tc);
    } else if (tc.status === 'NOT_RUN') {
      notRunCases++;
      notRunCasesList.push(tc);
    } else {
      passCases++;
    }
  }

  const passRate = totalCases > 0 ? ((passCases / totalCases) * 100).toFixed(1) : '0.0';
  const failRate = totalCases > 0 ? ((failCases / totalCases) * 100).toFixed(1) : '0.0';
  const notRunRate = totalCases > 0 ? ((notRunCases / totalCases) * 100).toFixed(1) : '0.0';

  // 4. Gom nhóm lỗi theo Failure Patterns
  const failurePatterns: { [patternKey: string]: FailurePattern } = {};

  failedCasesList.forEach(tc => {
    tc.failedSteps.forEach(fs => {
      // Key gom nhóm dựa trên: action, target, expected, và observed (được chuẩn hóa)
      const cleanObserved = fs.observed.replace(/\s+/g, ' ').trim();
      const patternKey = `${fs.action} -> ${fs.target} | Expected: ${fs.expected} | Observed: ${cleanObserved}`;
      
      if (!failurePatterns[patternKey]) {
        failurePatterns[patternKey] = {
          errorMessage: fs.result,
          cases: []
        };
      }
      // Tránh duplicate test case trong cùng một pattern
      if (!failurePatterns[patternKey].cases.some(c => c.id === tc.id)) {
        failurePatterns[patternKey].cases.push({ id: tc.id, summary: tc.summary });
      }
    });
  });

  // 5. Sinh nội dung Markdown
  const runId = path.basename(reportDir);
  const dateStr = new Date().toLocaleString('vi-VN');

  let md = `# BÁO CÁO KẾT QUẢ KIỂM THỬ\n\n`;
  md += `* **Ngày xuất báo cáo:** ${dateStr}\n`;
  md += `* **Lượt chạy (Run ID):** \`${runId}\`\n`;
  md += `* **File Excel kết quả:** [${path.basename(excelPath)}](file:///${excelPath.replace(/\\/g, '/')})\n\n`;

  md += `## 📊 Tổng Quan Kết Quả (Test Run Stats)\n\n`;
  md += `| Chỉ số | Số lượng | Tỷ lệ |\n`;
  md += `| :--- | :---: | :---: |\n`;
  md += `| **Tổng số test cases** | **${totalCases}** | **100%** |\n`;
  md += `| ĐẠT (PASS) ✅ | ${passCases} | ${passRate}% |\n`;
  md += `| LỖI (FAIL) ❌ | ${failCases} | ${failRate}% |\n`;
  md += `| KHÔNG CHẠY (NOT RUN) ⚪ | ${notRunCases} | ${notRunRate}% |\n\n`;

  if (notRunCases > 0) {
    md += `> ⚠️ **${notRunCases} test case không có kết quả nào được ghi nhận** (đang OFF, không thuộc module filter, hoặc FAIL ngay từ precondition trước khi chạy step đầu tiên). Đối chiếu với console log/playwright report để xác định nguyên nhân: ${notRunCasesList.slice(0, 10).map(tc => `\`${tc.id}\``).join(', ')}${notRunCasesList.length > 10 ? '...' : ''}\n\n`;
  }

  md += `## 🔍 Phân Tích Nguyên Nhân Thất Bại (Failure Causes & Patterns)\n\n`;

  if (failCases === 0 && passCases > 0) {
    md += `🎉 **Tất cả ${passCases} test cases ĐÃ CHẠY đều PASS.** Không phát hiện lỗi trong các step được ghi nhận.\n\n`;
  } else if (failCases === 0) {
    md += `⚠️ **Không có test case nào được ghi nhận kết quả.** Kiểm tra lại lượt chạy — có thể toàn bộ đã fail từ precondition.\n\n`;
  } else {
    md += `Hệ thống đã tự động phân tích và gom nhóm **${failCases}** test cases lỗi thành các nhóm lỗi chung dưới đây:\n\n`;
    
    let patternIdx = 1;
    for (const [pattern, info] of Object.entries(failurePatterns)) {
      const parts = pattern.split(' | ');
      const actionTarget = parts[0];
      const expectedText = parts[1];
      const observedText = parts[2];

      md += `### ${patternIdx++}. Lỗi tương tác/so sánh trên: \`${actionTarget}\`\n`;
      md += `* **Trạng thái so sánh:**\n`;
      md += `  * \`${expectedText}\`\n`;
      md += `  * \`${observedText}\`\n`;
      md += `* **Thông báo lỗi chi tiết:** \`${info.errorMessage}\`\n`;
      md += `* **Số lượng ảnh hưởng:** \`${info.cases.length} cases\`\n`;
      md += `* **Các test cases bị ảnh hưởng:**\n`;
      info.cases.forEach(c => {
        md += `  * **${c.id}**: ${c.summary}\n`;
      });
      md += `\n---\n\n`;
    }

    md += `## 📋 Danh Sách Chi Tiết Test Cases Thất Bại\n\n`;
    md += `Dưới đây là chi tiết bước bị lỗi của từng test case:\n\n`;

    failedCasesList.forEach(tc => {
      md += `### ❌ Test Case: **${tc.id}** - ${tc.summary}\n`;
      tc.failedSteps.forEach(fs => {
        md += `* **Bước lỗi:** Step ${fs.step}\n`;
        md += `* **Hành động:** \`${fs.action}\` trên \`${fs.target}\` (giá trị truyền vào: \`${fs.value || 'N/A'}\`)\n`;
        md += `* **Kỳ vọng (Expected):** \`${fs.expected || 'N/A'}\`\n`;
        md += `* **Thực tế (Observed):** \`${fs.observed || 'N/A'}\`\n`;
        md += `* **Chi tiết lỗi:** \`${fs.result}\`\n`;
      });
      md += `\n`;
    });
  }

  // 6. Ghi file Markdown báo cáo
  const outPath = path.join(reportDir, 'summary_report.md');
  fs.writeFileSync(outPath, md, 'utf-8');

  console.log(`\n✅ [Reporter] Đã tạo thành công báo cáo tóm tắt:`);
  console.log(`   📂 Path: file:///${outPath.replace(/\\/g, '/')}\n`);
}

main().catch(err => {
  console.error(`❌ Lỗi trong tiến trình tạo báo cáo:`, err);
});
