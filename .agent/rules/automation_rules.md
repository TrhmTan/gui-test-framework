# Quy Tắc Chung cho QA Automation — unified-gui-testing-tool

> Áp dụng cho mọi tác vụ automation testing trong dự án này (TypeScript + Playwright).
> Framework theo kiến trúc Config-Driven: **"Code không đổi khi đổi dự án"** — mọi thay đổi nghiệp vụ chỉ thực hiện qua Excel và `config/project.yaml`.

---

## 1. Kiến Trúc Framework (KHÔNG tự ý sửa `src/`)

- Dự án này dùng kiến trúc **Config-Driven + Data-Driven**, KHÔNG phải POM truyền thống.
- `src/` chứa Engine chạy test (ConfigLoader, ExcelReader, ActionExecutor, DataResolver). **TUYỆT ĐỐI KHÔNG tự ý sửa `src/`** trừ khi được yêu cầu mở rộng keyword action mới.
- Mọi logic test case được khai báo trong file Excel L3 (`data/{Project}/L3_Low_Level/`).
- Mọi cấu hình dự án, module, URL được khai báo trong `config/project.yaml`.

---

## 2. Sinh Dữ Liệu Test (Test Data Rules)

- Tất cả trường yêu cầu unique (Mã BN, Tên bệnh nhân test, Email...) phải **sinh động** — KHÔNG hardcode giá trị cố định trong Excel.
- Sử dụng `${timestamp}`, `${uuid}`, `${random_int}` trong cột `value` của sheet `DATA_{MODULE}`.
- Dữ liệu phải **traceable** — nhìn vào DB biết ngay test nào tạo ra:

  ```
  Format: [prefix]_[module]_[timestamp]
  Ví dụ:  auto_DanhGiaBanDau_20260614
  ```

- **Không được để ô trống** trong sheet `DATA_{MODULE}` — dùng `n/a` hoặc `empty` theo đúng quy chuẩn trong [EXCEL_CONVENTIONS.md](EXCEL_CONVENTIONS.md).

---

## 3. Locator — ƯU TIÊN data-testid

Xem chi tiết đầy đủ tại [locator_strategy.md](locator_strategy.md).

Tóm tắt thứ tự ưu tiên:
1. **`data-testid`** ← **ƯU TIÊN SỐ 1** cho dự án này
2. `data-test`, `data-qa`
3. `aria-label`, `role`
4. `id`
5. `name`
6. Playwright semantic (`getByLabel`, `getByPlaceholder`)
7. CSS Selector ổn định
8. XPath (tuyệt đối cuối cùng)

---

## 4. Chất Lượng Code & Bàn Giao

Trước khi bàn giao bất kỳ file Excel hay script nào:
- Không có ô trống không lý do trong sheet DATA.
- Locator phải unique và đã verify trên DOM thực tế.
- Test suite phải **PASS ổn định tối thiểu 2 lần liên tiếp** (headed mode).

---

## 5. Quy Tắc Đặt Tên

### Element ID trong Excel

| Prefix | Loại element |
| :--- | :--- |
| `txt_` | Input text, textarea |
| `ddl_` hoặc `select_` | Dropdown, select |
| `btn_` | Button |
| `chk_` | Checkbox |
| `rad_` | Radio button |
| `lbl_` | Label, text hiển thị |
| `lnk_` | Link |
| `error_` | Vùng thông báo lỗi validation |
| `toast` | Toast notification |
| `modal_` | Modal/Popup |
| `tbl_` | Table |
| `tab_` | Tab |

### File Excel L3 Master

```
Master_Test_Suite_{catalog_no}_{Module_Name}.xlsx
Ví dụ: Master_Test_Suite_9.1.2_Danh_Gia_Ban_Dau.xlsx
```

### Sheet trong Excel

```
ELEMENT_{MODULE}  → Khai báo locators (ví dụ: ELEMENT_DANH_GIA_BAN_DAU)
DATA_{MODULE}     → Dữ liệu test case (ví dụ: DATA_DANH_GIA_BAN_DAU)
TEST_CASE_{MODULE}→ Kịch bản các bước (ví dụ: TEST_CASE_DANH_GIA_BAN_DAU)
```

---

## 6. Quản Lý File & Thư Mục

- Kiểm tra cấu trúc thư mục hiện có trước khi tạo file mới — tránh duplicate.
- File Excel đặt đúng thư mục: `data/{Project_Name}/{Level}/{Module_Folder}/`.
- **KHÔNG tự động xóa** file source khi chưa xác nhận với người dùng.
- Script tạm thời, file debug phải lưu trong `/tmp/` — KHÔNG để tràn vào thư mục gốc dự án.

---

## 7. Git Restrictions

- **ĐƯỢC PHÉP:** `git status`, `git diff`, `git log` (read-only)
- **KHÔNG ĐƯỢC PHÉP:** `git pull`, `git checkout`, `git merge`, `git reset`, `git push` — trừ khi được yêu cầu tường minh bởi người dùng.

---

## 8. Quy Tắc Tương Tác và Xác Nhận (Checkpoint)

- **BẮT BUỘC có Checkpoint xác nhận trước khi sinh file Excel**:
  - Đối với các bước Step 1 (L1), Step 2 (L2), Step 3 (L3): AI **KHÔNG ĐƯỢC TỰ Ý** tạo mới hoặc ghi đè trực tiếp các file Excel thật trong thư mục `data/` ngay lập tức.
  - AI **phải** trình bày bản nháp (Draft) hoặc bảng kế hoạch (Plan/Rules/Scenarios) chi tiết dưới dạng bảng Markdown trên giao diện Chat trước để người dùng review.
  - AI **chỉ** được phép chạy code ghi file Excel thật sau khi nhận được sự đồng ý rõ ràng và tường minh (ví dụ: "ok", "đồng ý", "ghi file đi") từ phía USER.
  - Quy tắc này giúp người dùng kiểm soát bản nháp kịch bản, tránh lỗi ghi đè dữ liệu và có cơ hội tự thực hành hoặc điều chỉnh logic trước khi AI ghi file.

---

## 9. Ràng buộc phân rã L2 ➔ L3 (1-N Traceability & Step Lock)

- **RULE-05 (Traceability Mapping Lock - Phủ 100% L2):**
  - Mối quan hệ giữa kịch bản L2 và L3 là **1-N** (1 kịch bản Mid-level sẽ phân rã thành nhiều kịch bản Low-level chi tiết hơn để kiểm thử các dải dữ liệu biên/EP).
  - Mọi `ml_tc_id` có trong sheet `test_case_{module}` của file L2 bắt buộc phải được bao phủ bởi ít nhất một hoặc nhiều `ll_tc_id` trong sheet `TEST_CASE_{MODULE}` của file L3 Master.
  - Cấm tự ý lược bỏ hoặc bỏ quên bất kỳ `ml_tc_id` nào của L2.
- **RULE-06 (Step Alignment & Action Mapping):**
  - Khi phân rã L2 thành các kịch bản L3 chi tiết (Positive, Negative, Boundary), AI phải giữ nguyên luồng đi nghiệp vụ gốc từ L2 và cụ thể hóa các bước tương tác UI kỹ thuật (ví dụ: `click` chọn khách hàng, `input` giá trị cụ thể, `check_status` của message lỗi...).
  - Đảm bảo kịch bản L3 có đầy đủ các bước chuẩn bị cần thiết trước khi thao tác nhập liệu chính (như đăng nhập, chọn phòng khám, click chọn đối tượng...) tương tự như mô tả nghiệp vụ trong L2.
