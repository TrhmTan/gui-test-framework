---
name: generate_test_data
description: Hướng dẫn phân tích các trường nhập liệu và tự động sinh bộ dữ liệu kiểm thử (Happy Path, Negative, Boundary, Edge Cases).
---

# Skill: Sinh Dữ liệu Kiểm thử (Generate Test Data)

**Mục tiêu:** Quy trình từng bước hướng dẫn AI Agent tiếp nhận yêu cầu từ người dùng, phân tích các trường nhập liệu (fields) cùng các ràng buộc dữ liệu (constraints), từ đó tự động sinh ra bộ dữ liệu kiểm thử (Test Data) đầy đủ cấu trúc dưới dạng bảng Markdown (để ghi vào sheet Excel `DATA_<MODULE>`) hoặc JSON.

---

## 📥 ĐẦU VÀO CẦN THIẾT TỪ USER

Để sinh dữ liệu tối ưu nhất, hãy yêu cầu người dùng cung cấp các thông tin sau (nếu chưa có):

| Thông tin đầu vào | Mức độ bắt buộc | Mô tả |
| :--- | :---: | :--- |
| **Feature / Module** | Bắt buộc ✅ | Tên tính năng hoặc màn hình cần test (Ví dụ: "Form Đăng ký", "API Login"). |
| **Danh sách Fields** | Khuyến nghị ⚠️ | Danh sách các trường nhập liệu kèm theo ràng buộc. Nếu không có, AI sẽ tự phân tích từ DOM hoặc spec. |
| **Kịch bản / Test Cases** | Tùy chọn ❌ | Danh sách kịch bản kiểm thử (nếu có) để AI sinh dữ liệu ánh xạ chính xác với cột `test_case_type` (tc_id). |
| **Định dạng đầu ra** | Tùy chọn ❌ | Mặc định là `Markdown Table` (để copy vào sheet `DATA_<MODULE>`) hoặc `JSON`. |

---

## 🔁 CÁC BƯỚC THỰC HIỆN

### Bước 1: Phân tích Fields & Constraints (Ràng buộc dữ liệu)

1. **Xác định các thuộc tính của từng trường:**
   * Tên trường (Field Name) - Khớp với tên biến trong Test Case (ví dụ: `username`, `password`, `email`).
   * Kiểu dữ liệu (Data Type): String, Number, Boolean, Date, Enum...
   * Tính bắt buộc (Required): Có bắt buộc điền hay không.
   * Ràng buộc nghiệp vụ (Validation Rules): Độ dài tối thiểu/tối đa, định dạng (Regex), tính duy nhất (Unique), các giá trị chọn (Enum).

2. **Trình bày bảng tổng hợp Fields cho User xác nhận (CHECKPOINT ⏸️):**
   * *Ví dụ:*
     ```markdown
     | # | Field | Type | Required | Constraints | Notes |
     |---|-------|------|:---:|-------------|-------|
     | 1 | email | string | ✅ | format: email, unique | Dùng làm tài khoản đăng nhập |
     | 2 | password | string | ✅ | minLength: 8, maxLength: 20 | |
     | 3 | age | number | ❌ | min: 18, max: 60 | Số nguyên |
     ```
   * **Dừng lại chờ người dùng xác nhận** hoặc điều chỉnh danh sách trường trước khi thực hiện sinh data.

---

### Bước 2: Thiết kế, Đóng gói và Xuất Dữ liệu Kiểm thử

Áp dụng nghiêm ngặt các kỹ thuật thiết kế test data từ [test_design_rules.md](../rules/test_design_rules.md) để sinh dữ liệu kiểm thử. Chi tiết các kỹ thuật cần tham chiếu:
- **Phân vùng tương đương (EP):** Tham chiếu [EP trong test_design_rules.md](../rules/test_design_rules.md#1-ph%C3%A2n-v%C3%B9ng-t%C6%B0%C6%A1ng-%C4%91%C6%B0%E1%BB%9Bng-ep--equivalence-partitioning) để sinh dữ liệu Positive (Happy Path) và Negative (Validation). Đảm bảo tính độc nhất và truy vết bằng cách sử dụng timestamp/kịch bản: `auto_<test_name_or_tc_id>_<timestamp>`.
- **Phân tích giá trị biên (BVA):** Tham chiếu [BVA trong test_design_rules.md](../rules/test_design_rules.md#2-ph%C3%A2n-t%C3%ADch-gi%C3%A1-tr%E1%BB%8B-bi%C3%AAn-bva--boundary-value-analysis) để sinh dữ liệu Boundary. Riêng đối với các kịch bản kiểm thử giá trị biên (BVA) của các trường số, bắt buộc sinh tối thiểu **4 dòng dữ liệu (4 iterations)** để bao phủ đầy đủ các điểm biên (`min`, `min + ε`, `max - ε`, `max` cho vùng hợp lệ và `min - ε`, `cực tiểu`, `max + ε`, `xa hơn` cho vùng không hợp lệ).
- **One-wise và Pair-wise:** Tham chiếu [One-wise](../rules/test_design_rules.md#4-one-wise-testing) và [Pair-wise](../rules/test_design_rules.md#5-pair-wise-testing-ki%E1%BB%83m-th%E1%BB%B1-c%E1%BA%B7p-tham-s%E1%BB%91) để tối ưu hóa số lượng test case nhưng vẫn đảm bảo độ phủ.
- **Common Rules:** Tham chiếu [Common Rules](../rules/test_design_rules.md#common-rules) để xử lý định dạng chuỗi (Case-sensitive, Unicode, Lorem Ipsum có khoảng trắng cho max chars), kiểu số và ràng buộc nghiệp vụ đặc biệt (Edge Cases).

**Quy tắc đóng gói và xuất dữ liệu:**
Đóng gói dữ liệu theo đúng định dạng Excel/Markdown Table để có thể dễ dàng sao chép trực tiếp vào sheet `DATA_<MODULE_NAME_UPPER>`:
- **Định dạng cột đầu tiên:** Cột đầu tiên bắt buộc phải là `test_case_type` khớp 1-1 với đuôi `tc_xxx` hoặc `ll_xxx` của test case (dạng `pos_tc_xxx` hoặc `neg_tc_xxx`).
- **Số lượng Iterations:**
  - Mỗi kịch bản parameterized (`parameterized = Y`, bao gồm cả Happy Path và kịch bản validation lỗi độc lập) đều sinh tối thiểu **2 dòng dữ liệu (Iteration 1 & Iteration 2)**.
  - Riêng đối với các kịch bản kiểm thử giá trị biên (BVA) của các trường số, bắt buộc sinh tối thiểu **4 dòng dữ liệu (4 iterations)** có cùng giá trị `test_case_type`.
- **Tránh để trống ô:** Các ô trống của các cột không dùng trong kịch bản đó phải được điền bằng `empty` (nếu giả lập truyền chuỗi rỗng `""`) oặc `n/a` (nếu tùy chọn để skip). Tuyệt đối không để trống bất kỳ ô dữ liệu nào.
- **Dữ liệu cho các trường Dropdown:** Bắt buộc kiểm tra file JSON cấu hình dropdown tại `config/env_data/{Project_Name}/{MODULE_NAME}.json`. Đối với các trường dropdown có trong file JSON, sử dụng cú pháp tham chiếu động thay vì giá trị cứng:
  * Dữ liệu hợp lệ: Điền `$env_data.element_id[RANDOM]` hoặc `$env_data.element_id[INDEX:1]`.
  * Các vòng lặp Data-Driven (iterations): Điền tuần tự các INDEX khác nhau (ví dụ: Iteration 1 điền `INDEX:1`, Iteration 2 điền `INDEX:2`...) để chạy phủ qua nhiều option.
  * Dữ liệu lỗi (Negative): Điền giá trị tĩnh ngoài danh sách (ví dụ: `empty`, `"Invalid Option"`).

*Ví dụ định dạng đầu ra:*
```markdown
| test_case_type | customer | vaccine | dose | expected_error |
| :--- | :--- | :--- | :--- | :--- |
| pos_tc_001 | $env_data.ddl_customer[INDEX:1] | $env_data.ddl_vaccine_select[INDEX:1] | $env_data.ddl_dose_select[INDEX:1] | n/a |
| pos_tc_001 | $env_data.ddl_customer[INDEX:1] | $env_data.ddl_vaccine_select[INDEX:2] | $env_data.ddl_dose_select[INDEX:1] | n/a |
| neg_tc_003 | empty | $env_data.ddl_vaccine_select[RANDOM] | $env_data.ddl_dose_select[INDEX:1] | Khách hàng không được để trống |
```
