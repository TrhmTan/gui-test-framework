import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { appConfig } from './src/core/ConfigLoader';

/** Đường dẫn file storageState được tạo bởi global-setup */
const storageStatePath = path.resolve(__dirname, '.run/storage-state.json');

// Lấy cấu hình từ ConfigLoader (đọc từ config/project.yaml + config/credentials.env)
const currentEnv = appConfig.currentEnv;
const resolvedBaseUrl = appConfig.baseUrl;

// Export ánh xạ URL để các module khác có thể tham chiếu nếu cần
export const ENV_CONFIGS: Record<string, string> = appConfig.project.base_url;

console.log(`[Config] Môi trường hoạt động: [${currentEnv.toUpperCase()}] -> Base URL: ${resolvedBaseUrl}`);

// Đối tượng cấu hình dùng chung cho dự án
export const config = {
  baseUrl: resolvedBaseUrl,
  excelPath: process.env.EXCEL_PATH
    ? path.resolve(process.env.EXCEL_PATH)
    : path.resolve(__dirname, './data/Master_test_suite.xlsx'),
  highLevelExcelDir: path.resolve(__dirname, './data/high_level'),
  reportsDir: path.resolve(__dirname, './reports'),
  defaultTimeout: appConfig.defaultTimeout,
  headless: appConfig.isHeadless,
  browserOptions: {
    viewport: { width: 1920, height: 1080 }
  }
};

export default defineConfig({
  testDir: './tests',
  outputDir: './reports/test-results',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  timeout: 120 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  /* Chạy tuần tự các file test để tránh xung đột I/O ghi đè kết quả file Excel */
  fullyParallel: false,
  workers: 1,

  reporter: [
    ['line'],
    ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || 'reports/playwright-report', open: 'never' }],
    // JUnit XML reporter — GitLab CI tự động đọc file này để hiển thị tab Tests
    ...(process.env.PLAYWRIGHT_JUNIT_OUTPUT_NAME
      ? [['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_NAME }] as any]
      : [])
  ],

  use: {
    baseURL: config.baseUrl,
    headless: config.headless,
    ignoreHTTPSErrors: true,
    viewport: config.browserOptions.viewport,
    actionTimeout: config.defaultTimeout,
    navigationTimeout: 60 * 1000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // Tái sử dụng session login từ global-setup (đã lưu cookies) → không cần re-login giữa các TC
    ...(fs.existsSync(storageStatePath) ? { storageState: storageStatePath } : {}),
    // Nạp HTTP Basic Auth cho môi trường local
    ...(currentEnv === 'local' ? {
      httpCredentials: {
        username: appConfig.credentials.LOCAL_HTTP_USER,
        password: appConfig.credentials.LOCAL_HTTP_PASS
      }
    } : {})
  },

  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
    },
    // {
    //   name: 'msedge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // }
    // 'firefox' project: uses Playwright's bundled Firefox (no external browser channel
    // required). Useful in CI/sandbox environments where Google Chrome isn't installed
    // and/or Chrome-for-Testing binary downloads are network-restricted. Run with:
    //   npx playwright test --project=firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],
});
