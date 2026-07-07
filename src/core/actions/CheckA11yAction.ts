import { ActionHandler, ActionHandlerContext } from './ActionHandler';
import { TestCaseStep } from '../../types';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { AssertionFailedError } from '../errors/AssertionFailedError';

/** Các giá trị Target được coi là "quét toàn trang" thay vì 1 phần tử/khu vực cụ thể */
const FULL_PAGE_TARGETS = ['', 'page', 'full_page', 'fullpage', 'toan_trang'];

/** Mức độ nghiêm trọng mặc định — quét fail nếu có vi phạm ở bất kỳ mức nào trong danh sách này */
const DEFAULT_SEVERITY = ['critical', 'serious', 'moderate', 'minor'];

const IMPACT_LABEL: Record<string, string> = {
  critical: 'Nghiêm trọng',
  serious: 'Nghiêm túc',
  moderate: 'Trung bình',
  minor: 'Nhẹ'
};

/**
 * Cú pháp cột Expected cho check_a11y (tất cả tùy chọn, có thể để trống để dùng mặc định):
 *   - "disable:rule-id-1,rule-id-2"  → tắt tạm các rule đã biết là false-positive/chưa fix kịp
 *   - "exclude:.selector-1,#id-2"    → loại vùng DOM này khỏi phạm vi quét (banner quảng cáo, iframe bên thứ 3...)
 *   - "tags:wcag2a,wcag2aa"          → chỉ chạy rule thuộc chuẩn WCAG chỉ định (mặc định: tất cả rule của axe-core)
 *   - "severity:critical,serious"    → chỉ coi là FAILED khi có vi phạm ở mức này trở lên (mặc định: mọi mức)
 *   - Kết hợp nhiều mục bằng ";": "exclude:.ads;severity:critical,serious"
 */
function parseA11yOptions(expected: string): {
  disableRules: string[];
  excludeSelectors: string[];
  tags: string[];
  severity: string[];
} {
  const disableRules: string[] = [];
  const excludeSelectors: string[] = [];
  const tags: string[] = [];
  let severity = DEFAULT_SEVERITY;

  if (!expected) return { disableRules, excludeSelectors, tags, severity };

  const parts = expected.split(';').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('disable:')) {
      disableRules.push(...part.substring(8).split(',').map(s => s.trim()).filter(Boolean));
    } else if (lower.startsWith('exclude:')) {
      excludeSelectors.push(...part.substring(8).split(',').map(s => s.trim()).filter(Boolean));
    } else if (lower.startsWith('tags:')) {
      tags.push(...part.substring(5).split(',').map(s => s.trim()).filter(Boolean));
    } else if (lower.startsWith('severity:')) {
      const vals = part.substring(9).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (vals.length > 0) severity = vals;
    }
  }
  return { disableRules, excludeSelectors, tags, severity };
}

export class CheckA11yAction implements ActionHandler {
  async execute(step: TestCaseStep, context: ActionHandlerContext) {
    const { page, locatorString, resolvedValue, resolvedExpected, tcId, contextData } = context;

    const targetKey = (step.target || '').trim().toLowerCase();
    const isFullPage = FULL_PAGE_TARGETS.includes(targetKey);

    if (!isFullPage && !locatorString) {
      throw new Error(`Không tìm thấy locator cho phần tử cần quét accessibility: ${step.target}`);
    }

    const { disableRules, excludeSelectors, tags, severity } = parseA11yOptions(resolvedExpected);

    const builder = new AxeBuilder({ page });
    if (!isFullPage && locatorString) {
      builder.include(locatorString);
    }
    excludeSelectors.forEach(sel => builder.exclude(sel));
    if (disableRules.length > 0) builder.disableRules(disableRules);
    if (tags.length > 0) builder.withTags(tags);

    const results = await builder.analyze();
    const relevantViolations = results.violations.filter(v =>
      severity.includes((v.impact || 'minor').toLowerCase())
    );

    // Ghi report JSON đầy đủ (kể cả khi PASSED) để review chi tiết / đính kèm bằng chứng audit
    const runId = contextData.__runId || `run_${Date.now()}`;
    const reportBaseName = (resolvedValue && resolvedValue.trim() !== '')
      ? resolvedValue.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')
      : `a11y_${tcId || 'TC'}_step${step.step}`;
    const reportPath = path.resolve(process.cwd(), 'reports', runId, 'a11y', `${reportBaseName}.json`);
    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(results.violations, null, 2), 'utf-8');
    } catch (e) {
      console.error('   ⚠️ Không thể ghi report accessibility JSON:', e);
    }

    const expectedLabel = `0 vi phạm mức ${severity.join('/')}`;

    if (relevantViolations.length === 0) {
      const scannedLabel = isFullPage ? 'toàn trang' : `phần tử [${step.target}]`;
      return {
        status: 'PASSED' as const,
        observed: `Không tìm thấy vi phạm accessibility (mức ${severity.join('/')}) khi quét ${scannedLabel}.`,
        expected: expectedLabel
      };
    }

    const countByImpact = relevantViolations.reduce((acc: Record<string, number>, v) => {
      const key = v.impact || 'minor';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const countSummary = Object.entries(countByImpact)
      .map(([k, v]) => `${IMPACT_LABEL[k] || k}: ${v}`)
      .join(', ');
    const detailSummary = relevantViolations
      .map(v => `[${IMPACT_LABEL[v.impact || 'minor'] || v.impact}] ${v.id}: ${v.help} (${v.nodes.length} phần tử)`)
      .join(' | ');

    throw new AssertionFailedError(
      `Tìm thấy ${relevantViolations.length} vi phạm accessibility (${countSummary}). ${detailSummary}. Chi tiết đầy đủ: ${path.relative(process.cwd(), reportPath)}`,
      expectedLabel
    );
  }
}

export default CheckA11yAction;
