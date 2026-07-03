export interface PageConfig {
  page_key: string;
  url: string;
}

export interface ElementConfig {
  element_id: string;
  locator_type: string;
  locator_value: string;
  description?: string;
}

export interface TestCaseStep {
  step: number;
  action: string;
  target: string;
  value: string;
  expected: string;
  observed?: string;
  test_result?: string;
  screenshot?: string;
}

export interface TestCase {
  tc_id: string;
  summary: string;
  type: string;
  parameterized: string; // 'Y' hoặc 'N'
  parameterized_raw?: string; // Giá trị thô trong Excel
  added_manually?: string; // 'Y' hoặc 'N'
  is_run_raw?: string; // Giá trị thô của cột is_run trong Excel
  fr?: string; // Functional Requirement
  yc?: string; // Yêu cầu (coverage report)
  precondition?: string; // ID của precondition (ví dụ: pre_1)
  steps: TestCaseStep[];
}

export interface TestDataRow {
  test_case_type: string; // tc_id tương ứng
  [key: string]: any; // Dữ liệu động
}
