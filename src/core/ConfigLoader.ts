import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

// ═══════════════════════════════════════════════════════════════
// ConfigLoader — Module tập trung đọc config dự án
// ═══════════════════════════════════════════════════════════════
// Nguồn config theo thứ tự ưu tiên (cao → thấp):
//   1. CLI env vars (process.env.*) — truyền từ command line
//   2. config/project.yaml          — project settings
//   3. config/credentials.env       — sensitive data (gitignored)
// ═══════════════════════════════════════════════════════════════

// ── Interfaces ──────────────────────────────────────────────────

export interface ProjectConfig {
  project_name: string;
  project_label: string;
  domain: string;
  base_url: Record<string, string>;
  default_env: string;
  data_dir: string;
  global_config: string;
  common_rules: string;
  headless: boolean;
  default_timeout: number;
  cross_iteration_columns: string[];
}

export interface Credentials {
  LOCAL_HTTP_USER: string;
  LOCAL_HTTP_PASS: string;
}

export interface AppConfig {
  project: ProjectConfig;
  credentials: Credentials;
  // Computed helpers (resolved with CLI overrides)
  currentEnv: string;
  baseUrl: string;
  isHeadless: boolean;
  defaultTimeout: number;
  crossIterationColumns: string[];
}

// YAML parsing handled by js-yaml library (replaces custom parser)

// ── ConfigLoader ────────────────────────────────────────────────

function loadProjectConfig(): ProjectConfig {
  const projectRoot = path.resolve(__dirname, '../../');
  const yamlPath = path.join(projectRoot, 'config', 'project.yaml');

  if (!fs.existsSync(yamlPath)) {
    console.warn(`[ConfigLoader] Warning: config/project.yaml not found at ${yamlPath}. Using defaults.`);
    return getDefaultProjectConfig();
  }

  const raw = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = yaml.load(raw) as Record<string, any>;

  // Handle cross_iteration_columns: js-yaml trả về array chuẩn từ YAML list
  let crossColumns: string[] = [];
  if (Array.isArray(parsed.cross_iteration_columns)) {
    crossColumns = parsed.cross_iteration_columns.map(String);
  } else if (typeof parsed.cross_iteration_columns === 'string') {
    crossColumns = parsed.cross_iteration_columns.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  return {
    project_name: parsed.project_name || 'Tiem_Chung',
    project_label: parsed.project_label || '',
    domain: parsed.domain || 'healthcare',
    base_url: (parsed.base_url as Record<string, string>) || {},
    default_env: parsed.default_env || 'test',
    data_dir: parsed.data_dir || 'data/Tiem_Chung',
    global_config: parsed.global_config || 'config/global/preconditions.xlsx',
    common_rules: parsed.common_rules || 'config/global/common_rules.xlsx',
    headless: parsed.headless !== false,  // default true; .env HEADLESS takes priority
    default_timeout: typeof parsed.default_timeout === 'number' ? parsed.default_timeout : 10000,
    cross_iteration_columns: crossColumns,
  };
}

function loadCredentials(): Credentials {
  const projectRoot = path.resolve(__dirname, '../../');
  const credPath = path.join(projectRoot, 'config', 'credentials.env');

  let parsed: Record<string, string> = {};
  if (fs.existsSync(credPath)) {
    const content = fs.readFileSync(credPath, 'utf-8');
    parsed = dotenv.parse(content);
  } else {
    console.warn(`[ConfigLoader] Warning: config/credentials.env not found. Using defaults.`);
  }

  // Strip surrounding quotes from password if present
  let pass = parsed.LOCAL_HTTP_PASS || '';
  pass = pass.replace(/^"|"$/g, '');

  const user = parsed.LOCAL_HTTP_USER || '';

  if (!pass || !user) {
    console.warn('[ConfigLoader] ⚠️ LOCAL_HTTP_USER hoặc LOCAL_HTTP_PASS chưa được cấu hình trong config/credentials.env. Một số tính năng yêu cầu xác thực HTTP Basic Auth sẽ không hoạt động.');
  }

  return {
    LOCAL_HTTP_USER: user,
    LOCAL_HTTP_PASS: pass,
  };
}

function getDefaultProjectConfig(): ProjectConfig {
  return {
    project_name: 'your-project',
    project_label: 'Your QA Automation Project',
    domain: 'example',  // set to your project's domain, e.g. healthcare, ecommerce, fintech
    base_url: {
      local: 'http://192.0.2.10:8088',
      test: 'https://test.example.com',
      sit: 'https://sit.example.com',
    },
    default_env: 'test',
    data_dir: 'data/your-project',
    global_config: 'config/global/preconditions.xlsx',
    common_rules: 'config/global/common_rules.xlsx',
    headless: true,  // default: hình ẩn; override bằng HEADLESS=false trong .env
    default_timeout: 10000,
    cross_iteration_columns: [],  // e.g. columns whose values should be shared/reused across loop iterations in a test case
  };
}

function buildAppConfig(): AppConfig {
  const project = loadProjectConfig();
  const credentials = loadCredentials();

  // project.yaml được ưu tiên; CLI TEST_ENV override môi trường
  const currentEnv = (process.env.TEST_ENV || project.default_env || 'local').toLowerCase();
  const baseUrl = project.base_url[currentEnv] || project.base_url['test'] || 'https://test.example.com';
  // headless đọc từ project.yaml — nguồn duy nhất, không bị .env override
  const isHeadless = project.headless;
  const defaultTimeout = process.env.DEFAULT_TIMEOUT
    ? parseInt(process.env.DEFAULT_TIMEOUT, 10)
    : project.default_timeout;

  // CLI override for cross_iteration_columns
  let crossIterationColumns = project.cross_iteration_columns;
  if (process.env.CROSS_ITERATION_COLUMNS) {
    crossIterationColumns = process.env.CROSS_ITERATION_COLUMNS.split(',').map(s => s.trim()).filter(Boolean);
  }

  return {
    project,
    credentials,
    currentEnv,
    baseUrl,
    isHeadless,
    defaultTimeout,
    crossIterationColumns,
  };
}

// ── Export Singleton ──────────────────────────�
export const appConfig: AppConfig = buildAppConfig();
export default appConfig;
