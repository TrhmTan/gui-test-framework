import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// SharedRuntimeContext — Cross-module Data Flow
// ═══════════════════════════════════════════════════════════════
// Cho phép truyền dữ liệu giữa các module test (ví dụ: patient_id
// từ Tiếp đón → Đánh giá → Sàng lọc → Tiêm chủng).
// Data được persist qua file JSON trong thư mục .run/
// để hỗ trợ cả chạy tuần tự lẫn parallel workers.
// ═══════════════════════════════════════════════════════════════

const CONTEXT_FILE = path.resolve(process.cwd(), '.run', 'shared_context.json');

export class SharedRuntimeContext {
  private data: Record<string, string> = {};

  constructor() {
    this.load();
  }

  /** Lưu giá trị vào context (persist ngay lập tức ra file) */
  set(key: string, value: string): void {
    this.data[key] = value;
    this.save();
  }

  /** Đọc giá trị từ context */
  get(key: string): string {
    // Reload từ file để đảm bảo có data mới nhất (nếu worker khác đã ghi)
    this.load();
    return this.data[key] || '';
  }

  /** Kiểm tra key có tồn tại không */
  has(key: string): boolean {
    this.load();
    return key in this.data;
  }

  /** Xóa toàn bộ context (dùng khi bắt đầu run mới) */
  clear(): void {
    this.data = {};
    this.save();
  }

  /** Lấy snapshot toàn bộ context (read-only) */
  getAll(): Readonly<Record<string, string>> {
    this.load();
    return { ...this.data };
  }

  private load(): void {
    try {
      if (fs.existsSync(CONTEXT_FILE)) {
        this.data = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf-8'));
      }
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    const dir = path.dirname(CONTEXT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}

// Singleton instance — dùng chung cho toàn bộ codebase
export const sharedContext = new SharedRuntimeContext();
