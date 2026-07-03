import * as path from 'path';
import * as fs from 'fs';
import { appConfig } from './ConfigLoader';
import { sharedContext } from './SharedRuntimeContext';

export class DataResolver {
  private envConfig: Record<string, string>;

  constructor(envConfig: Record<string, string> = process.env as Record<string, string>) {
    this.envConfig = envConfig;
  }

  /**
   * Giải quyết biểu thức dropdown dynamic theo môi trường.
   * 
   * Cơ chế đọc data (theo thứ tự ưu tiên):
   * 1. shared.json  — file data tập trung duy nhất cho toàn project (khuyến nghị dùng)
   * 2. {module}.json — file riêng theo tên Excel (override shared nếu cần)
   */
  private resolveEnvData(elementId: string, selector: string): string {
    try {
      const projectRoot = path.resolve(__dirname, '../../');
      const projectName = appConfig.project.project_name || 'Tiem_Chung';
      const currentEnv = (process.env.TEST_ENV || appConfig.currentEnv || 'test').toUpperCase();
      const envDataDir = path.join(projectRoot, 'config', 'env_data', projectName);

      // ── Helper: load options từ 1 file JSON ────────────────────
      const loadOptions = (jsonPath: string): string[] | null => {
        if (!fs.existsSync(jsonPath)) return null;
        try {
          const configJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          const envData = configJson[currentEnv];
          if (!envData) return null;
          const options = envData[elementId];
          return Array.isArray(options) && options.length > 0 ? options : null;
        } catch {
          return null;
        }
      };

      // ── Bước 1: Thử file riêng theo tên Excel (override) ───────
      let options: string[] | null = null;
      const excelPath = process.env.EXCEL_PATH || '';
      if (excelPath) {
        const filename = path.basename(excelPath, '.xlsx');
        const jsonFilename = filename.replace(/^master_test_suite_/i, '');
        const modulePath = path.join(envDataDir, `${jsonFilename}.json`);
        options = loadOptions(modulePath);
      }

      // ── Bước 2: Fallback về shared.json nếu chưa tìm thấy ─────
      if (!options) {
        const sharedPath = path.join(envDataDir, 'shared.json');
        options = loadOptions(sharedPath);
        if (!options) {
          console.warn(`[DataResolver] Warning: Không tìm thấy key [${elementId}] trong shared.json hoặc file module. Env: ${currentEnv}`);
          return '';
        }
      }

      // ── Bước 3: Resolve theo selector ──────────────────────────
      const upperSelector = selector.toUpperCase();
      if (upperSelector === 'RANDOM') {
        return options[Math.floor(Math.random() * options.length)];
      } else if (upperSelector.startsWith('INDEX:')) {
        const idx = parseInt(upperSelector.split(':')[1], 10) - 1; // 1-indexed → 0-indexed
        return options[Math.max(0, Math.min(idx, options.length - 1))];
      }

      return '';
    } catch (e: any) {
      console.error(`[DataResolver] Lỗi khi giải quyết dropdown data động:`, e.message);
      return '';
    }
  }

  /**
   * Thay thế các placeholder dữ liệu động.
   * Hỗ trợ các định dạng:
   * 1. $data_login.username hoặc $data_login.password (Excel style của Anh Tester)
   * 2. ${variable} (Dữ liệu động)
   * 3. ${env:VARIABLE} (Biến môi trường)
   * 4. $env_data.element_id[selector] (Dữ liệu dropdown theo môi trường)
   * @param value Chuỗi văn bản chứa biến cần xử lý
   * @param contextData Bảng chứa dữ liệu dòng DATA hiện tại
   */
  resolve(value: string, contextData: Record<string, any> = {}): string {
    if (value === undefined || value === null) return '';
    let strValue = String(value).trim();

    // 0. Xử lý định dạng dữ liệu dropdown động $env_data.element_id[selector]
    const envDataRegex = /\$env_data\.([a-zA-Z0-9_]+)\[(RANDOM|INDEX:\d+)\](?::(name|pid|phone|part\(\d+\)))?/gi;
    if (envDataRegex.test(strValue)) {
      envDataRegex.lastIndex = 0; // Reset index cho regex
      strValue = strValue.replace(envDataRegex, (match, elementId, selector, modifier) => {
        const fullVal = this.resolveEnvData(elementId, selector);
        if (!modifier) return fullVal;
        
        // Split chuỗi bằng các dấu gạch ngang phổ biến có khoảng trắng xung quanh (em-dash U+2014, en-dash U+2013, hyphen U+002D)
        const parts = fullVal.split(/\s+[\u2014\u2013-]\s+/);
        const lowerMod = modifier.toLowerCase();
        if (lowerMod === 'name' || lowerMod === 'part(0)') {
          return parts[0] ? parts[0].trim() : fullVal;
        }
        if (lowerMod === 'pid' || lowerMod === 'part(1)') {
          return parts[1] ? parts[1].trim() : fullVal;
        }
        if (lowerMod === 'phone' || lowerMod === 'part(2)') {
          return parts[2] ? parts[2].trim() : fullVal;
        }
        if (lowerMod.startsWith('part(')) {
          const matchPart = lowerMod.match(/\d+/);
          if (matchPart) {
            const partIdx = parseInt(matchPart[0], 10);
            return parts[partIdx] ? parts[partIdx].trim() : fullVal;
          }
        }
        return fullVal;
      });
    }

    // 1. Xử lý định dạng biến trực tiếp: $data_xxx.column_name (ví dụ: $data_login.username)
    const directDataRegex = /^\$data_[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)$/;
    const directMatch = strValue.match(directDataRegex);
    if (directMatch) {
      const columnName = directMatch[1];
      if (columnName && contextData && columnName in contextData) {
        const rawColumnValue = String(contextData[columnName]);
        // Phân giải giá trị (ví dụ: $env_data.ddl_room[RANDOM] → giá trị thực)
        const resolvedColumnValue = this.resolve(rawColumnValue, contextData);
        // Cache: ghi đè ngược lại contextData để cùng TC không resolve lại pattern random/index
        // Chỉ mutation khi giá trị thực sự thay đổi sau resolve
        if (rawColumnValue !== resolvedColumnValue) {
          contextData[columnName] = resolvedColumnValue;
        }
        return resolvedColumnValue;
      }
      return '';
    }

    // 2. Xử lý định dạng biến lồng trong chuỗi văn bản: $data_xxx.column_name
    const inlineDataRegex = /\$data_[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)/g;
    strValue = strValue.replace(inlineDataRegex, (match, columnName) => {
      if (contextData && columnName in contextData) {
        const rawColumnValue = String(contextData[columnName]);
        const resolvedColumnValue = this.resolve(rawColumnValue, contextData);
        // Cache: chỉ ghi đè khi giá trị thay đổi
        if (rawColumnValue !== resolvedColumnValue) {
          contextData[columnName] = resolvedColumnValue;
        }
        return resolvedColumnValue;
      }
      return match;
    });

    // 3. Xử lý định dạng ${variable} hoặc ${env:VARIABLE}
    strValue = strValue.replace(/\${(.*?)}/g, (match, key) => {
      const trimmedKey = key.trim();

      // Nạp từ biến môi trường: ${env:BASE_URL}
      if (trimmedKey.startsWith('env:')) {
        const envVarName = trimmedKey.substring(4);
        return this.envConfig[envVarName] !== undefined ? this.envConfig[envVarName] : '';
      }

      // Nạp từ dòng test data: ${username}
      if (contextData && trimmedKey in contextData) {
        return String(contextData[trimmedKey]);
      }

      return match;
    });

    // 4. Xử lý $context.key — đọc từ SharedRuntimeContext (cross-module data)
    // Ví dụ: $context.patient_code → lấy giá trị đã capture/set từ module trước
    const contextRegex = /\$context\.([a-zA-Z0-9_]+)/g;
    strValue = strValue.replace(contextRegex, (_match, key) => {
      const contextValue = sharedContext.get(key);
      if (contextValue) {
        console.log(`   🔗 [DataResolver] $context.${key} → "${contextValue}"`);
      }
      return contextValue || _match; // Giữ nguyên pattern nếu key chưa tồn tại
    });

    return strValue;
  }
}
export default DataResolver;
