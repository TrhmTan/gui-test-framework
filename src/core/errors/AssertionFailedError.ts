// NOTE: Tên class giữ "Assertion" (thay vì "Assertion" đúng tiếng Anh)
// để đảm bảo tương thích ngược với error.name matching trong ActionExecutor.ts.
// Không đổi tên trừ khi rename toàn bộ codebase đồng thời.
export class AssertionFailedError extends Error {
  public observed: string;
  public expected: string;

  constructor(observed: string, expected: string, message?: string) {
    super(message || `So sánh thất bại: thực tế "${observed}" không khớp với kỳ vọng "${expected}"`);
    this.name = 'AssertionFailedError';
    this.observed = observed;
    this.expected = expected;
  }
}
export default AssertionFailedError;
