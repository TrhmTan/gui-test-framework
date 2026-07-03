# 🚫 No Hardcode Rule (Nguyên tắc chống ghi mã cứng)

Tài liệu này định nghĩa các quy tắc bắt buộc nhằm ngăn chặn tuyệt đối việc viết các giá trị cố định (hardcode) trong kịch bản test Excel và mã nguồn TypeScript. Quy tắc này giúp framework đạt được mục tiêu cốt lõi: **"Code không đổi khi đổi dự án, test data không đổi khi đổi môi trường"**.

AI Agent và QA Engineer bắt buộc phải tuân thủ nghiêm ngặt các quy định dưới đây.

---

## 🚫 1. Các vùng cấm Hardcode (Forbidden Hardcoding Zones)

### 1.1 Địa chỉ URL & Endpoints
*   **CẤM**: Ghi trực tiếp địa chỉ URL đầy đủ (ví dụ: `https://test.example.com/vaccination/screening`) vào cột `value` hay `target` của kịch bản test hoặc trong mã nguồn TypeScript.
*   **Giải pháp chuẩn**: 
    *   Tất cả các URL phải được khai báo dạng tương đối (relative path, ví dụ: `/vaccination/screening`) trong sheet **`PAGE`** (nằm ở `Global_config.xlsx` hoặc ghi đè ở file L3 Master).
    *   Khi thực hiện hành động truy cập trang, chỉ truyền `page_key` (ví dụ: `pg_screening`).
    *   Framework sẽ tự động ghép nối `page_key` -> relative URL -> kết hợp với `base_url` tương ứng từ môi trường được cấu hình trong `project.yaml`.

```text
❌ SAI: action = navigate | target = https://test.example.com/vaccination/screening
✅ ĐÚNG: action = navigate | target = pg_screening (với pg_screening đã được định nghĩa url là /vaccination/screening)
```

---

### 1.2 Thông tin đăng nhập & Dữ liệu nhạy cảm (Credentials & Secrets)
*   **CẤM**: Ghi trực tiếp username, password, token, API key của tài khoản test vào kịch bản Excel hoặc mã nguồn.
*   **Giải pháp chuẩn**:
    *   Tất cả tài khoản phải được cấu hình thông qua biến môi trường trong file **`config/credentials.env`** (file này nằm trong `.gitignore`).
    *   Trong Excel dùng cú pháp tham chiếu biến môi trường **`${env:VAR_NAME}`** tại sheet `DATA_LOGIN` của `Global_config.xlsx`.
    *   Khi chạy test case, tham chiếu tài khoản qua biến dữ liệu đăng nhập: **`$data_login_{role}.username`** hoặc **`$data_login_{role}.password`**.

```text
❌ SAI: action = input | target = txt_username | value = doctor_admin_test
✅ ĐÚNG: action = input | target = txt_username | value = $data_login_doctor.username
```

---

### 1.3 Thời gian chờ cứng (Hardcoded Wait / Sleep)
*   **CẤM**: Sử dụng các câu lệnh chờ cứng vô căn cứ hoặc các hành động chờ tĩnh (ví dụ: `waitForTimeout(5000)`, `Thread.sleep(3000)` trong code, hoặc hành động `wait_for` với giá trị mili-giây tĩnh trong Excel mà không có lý do bất khả kháng). Việc này làm tăng tổng thời gian chạy test (flaky/slow test).
*   **Giải pháp chuẩn**: 
    *   Sử dụng **chờ động (Dynamic Wait)** dựa trên trạng thái của UI Element thông qua thuộc tính `expected` (chờ cho tới khi element hiển thị `visible`, ẩn đi `hidden`, hoặc có thể tương tác `enabled`).
    *   Chỉ sử dụng hành động `wait_for` với mili-giây tĩnh khi bắt buộc phải chờ một hiệu ứng animation chuyển cảnh của bên thứ ba hoàn tất mà không thể bắt được element state.

```text
❌ SAI: action = wait_for | target = btn_save | value = 5000 (chờ 5 giây vô điều kiện)
✅ ĐÚNG: action = wait_for | target = btn_save | expected = visible (chờ cho đến khi nút lưu hiển thị)
```

---

### 1.4 Đường dẫn tệp tin (File Paths)
*   **CẤM**: Viết đường dẫn tuyệt đối bắt đầu bằng ký tự ổ đĩa trên máy cá nhân (ví dụ: `C:\Users\your-username\Documents\...`) trong code hoặc file cấu hình Excel.
*   **Giải pháp chuẩn**:
    *   Tất cả các đường dẫn file (file upload, file config, template...) phải sử dụng **đường dẫn tương đối (Relative Path)** tính từ thư mục gốc của workspace (Root Project).
    *   *Ví dụ*: `data/templates/template_L3_Master.xlsx`, `config/project.yaml`.

---

## 🛠️ 2. Quy trình xử lý biến động (Dynamic Data Handling)

Để kiểm thử cùng một kịch bản trên nhiều môi trường (`local`, `test`, `sit`, `uat`) hoặc cho nhiều chi nhánh bệnh viện khác nhau mà không phải sửa dữ liệu Excel:

1.  **Dữ liệu động theo môi trường**: Đưa các cấu hình động vào file `config/project.yaml` dưới khóa `base_url` và thay đổi môi trường chạy thông qua tham số dòng lệnh (ví dụ: `npm test -- --env=sit`).
2.  **Dữ liệu động theo chi nhánh/bệnh viện**: Khai báo cột chi nhánh trong khóa `cross_iteration_columns` của `project.yaml`. Framework sẽ tự động lặp lại các kịch bản test trên toàn bộ danh sách chi nhánh được cấu hình mà không cần nhân bản dòng dữ liệu trong Excel.

---

## 🤖 3. Checklist tự kiểm tra dành cho AI Agent (Self-Checklist)

AI Agent bắt buộc phải tự quét các nội dung tạo mới hoặc sửa đổi để đảm bảo:
- [ ] Không chứa bất kỳ địa chỉ URL nào bắt đầu bằng `http://` hoặc `https://` trong kịch bản test Excel hoặc trong file `.ts` (ngoại trừ file cấu hình `project.yaml`).
- [ ] Không chứa bất kỳ thông tin mật khẩu hay username dạng text thuần nào trong code và Excel.
- [ ] Không chứa câu lệnh `page.waitForTimeout()` hoặc `setTimeout()` có giá trị cứng trong mã nguồn TypeScript (phải dùng `waitForSelector` hoặc assertions của Playwright).
- [ ] Tất cả các đường dẫn tệp tin được khai báo đều là đường dẫn tương đối từ root dự án.
