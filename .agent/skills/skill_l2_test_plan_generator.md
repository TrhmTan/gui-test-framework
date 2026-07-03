---
name: l2_test_plan_generator  
description: Skill sinh manual test cases và L2 Test Plan theo chuẩn 3-tầng của dự án (L1→L2→L3). Hỗ trợ 2 chế độ thiết kế — QUICK và FULL với phân tích chi tiết.
---

# L2 Mid-Level Test Plan Generator — Manual Testing Designer

**Mục đích:** Phân tích L1 Checklist và business rules để sinh file Excel **L2 Mid-Level** (`ML_TC_{Module_Name}.xlsx`) với 2 sheet chuẩn, làm cầu nối giữa L1 (phạm vi) và L3 (test steps chi tiết).

---

## When to Use

Sử dụng skill này khi:
- Có L1 Checklist (`HL_FR_*.xlsx`) và cần sinh L2 Test Plan
- Cần phân tích business rules và field validation
- Cần sinh manual test cases có traceability từ L1 → L2

**KHÔNG** dùng skill này khi:
- Cần sinh L3 chi tiết steps → dùng `generate_test_cases` workflow
- Cần sinh locator → dùng `smart_locator_agent`
- Cần sinh test data BVA → dùng `generate_test_data` workflow

---

## Cấu Trúc File Excel L2 Thực Tế

File `ML_TC_{catalog_no}_{Module_Name}.xlsx` có **2 sheet bắt buộc**:

### Sheet 1: `test_case_{module}` — 9 cột

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| `FR` | Mã chức năng từ L1 | `FR-9.1.3` |
| `YC` | Mã yêu cầu từ L1 | `YC-010` |
| `hl_tc_id` | ID từ L1 Checklist | `HL_001` |
| `ml_tc_id` | ID test case L2 (mới) | `ML_001` |
| `title` | Tên test case | `Mở phiếu khám sàng lọc thành công` |
| `preconditions` | Điều kiện tiên quyết | `pre_login_success` |
| `steps` | Các bước thực hiện | `navigate to URL...` |
| `test_data` | Dữ liệu dùng | `$data_kham_sang_loc.screening_room` |
| `expected` | Kết quả mong đợi | `Hiển thị form khám...` |

> **Quy tắc merge cell:** Khi 1 test case có nhiều steps, cột FR, YC, hl_tc_id, ml_tc_id, title, preconditions được merge theo chiều dọc. Các dòng step tiếp theo để trống ở các cột này.

### Sheet 2: `rule_{module}` — 7 cột ⭐ (Quan trọng)

Sheet này khai báo **validation rules cho từng trường** — nguồn dữ liệu vàng để sinh BVA test data:

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| `Trường thông tin` | Tên field + tên cột data | `Cân nặng (weight)` |
| `Bắt buộc (y/n)` | Field có bắt buộc không | `y` |
| `Kiểu điều khiển` | Loại UI element | `textbox` |
| `Kiểu dữ liệu` | Kiểu dữ liệu nhập | `float, int` |
| `Vùng Hợp Lệ` | Valid range/format | `1.0 <= weight <= 300.0` |
| `Vùng Không Hợp Lệ` | Invalid range | `weight <= 0.9 hoặc weight >= 300.1` |
| `Note (TBD/TBU)` | Ghi chú nghiệp vụ | `Làm tròn 1 chữ số thập phân` |

**Ví dụ thực tế từ Module Khám Sàng Lọc:**

| Trường thông tin | Bắt buộc | Kiểu | Kiểu dữ liệu | Vùng Hợp Lệ | Vùng Không Hợp Lệ |
|---|---|---|---|---|---|
| Cân nặng (weight) | y | textbox | float, int | 1.0 <= weight <= 300.0 | weight <= 0.9 hoặc weight >= 300.1 |
| Chiều cao (height) | y | textbox | float, int | 30.0 <= height <= 250.0 | height <= 29.9 hoặc height >= 250.1 |
| Nhiệt độ (temperature) | y | textbox | float, int | 30.0 <= temp <= 43.0 | temp <= 29.9 hoặc temp >= 43.1 |
| Huyết áp (blood_pressure) | n | textbox | string | Định dạng "tâm_thu/tâm_trương" | Không chứa "/" hoặc sai định dạng số |
| Mạch (pulse) | n | textbox | int | 30 <= pulse <= 200 | pulse <= 29 hoặc pulse >= 201 |
| SpO2 (spo2) | n | textbox | int | 50 <= spo2 <= 100 | spo2 <= 49 hoặc spo2 >= 101 |
| Mã PIN ký số (signature_pin) | y | textbox | string | Đúng 6 chữ số | Trống / Chứa chữ / Khác 6 chữ số |

---

## Các Chế Độ Thiết Kế

### Chế độ QUICK
- Dùng khi: requirements rõ ràng, module đơn giản
- Output: Chỉ sinh sheet `test_case_{module}`
- Không dừng chờ user giữa chừng

### Chế độ FULL (Quy trình 6 bước)
Dùng khi: module phức tạp, cần phân tích rủi ro và làm rõ nghiệp vụ

1. **Đọc L1** → hiểu phạm vi tính năng
2. **Phân tích Ambiguity** → liệt kê câu hỏi làm rõ
3. **Đánh giá Risk Level** (Critical/High/Medium/Low)
4. **Phân rã tính năng** → nhóm test scenarios
5. **Sinh sheet `rule_{module}`** → validation rules từng field
6. **Sinh sheet `test_case_{module}`** → test cases có traceability

---

## Strict Rules

### RM-01
File kịch bản L2 Mid-Level bắt buộc phải được tạo đúng cấu trúc chứa đủ 2 sheet: `test_case_{module}` (9 cột) và `rule_{module}` (7 cột).

### RM-02
Thiết kế các test cases phải áp dụng các kỹ thuật theo đúng thứ tự ưu tiên: EP (Phân vùng tương đương) -> BVA (Giá trị biên) -> One-wise -> Pair-wise.

### RM-03
Dữ liệu kiểm thử (test data) ở L2 bắt buộc phải được tham số hóa toàn bộ theo định dạng `$data_{MODULE}.{column_name}` đại diện cho các trường thông tin được thao tác trong steps, tuyệt đối cấm ghi giá trị tĩnh (hardcode) thực tế hoặc ghi chung chung.

### RM-04
Khi test case có nhiều bước (multiple steps), các cột thông tin chung ở đầu (FR, YC, hl_tc_id, title...) phải được merge theo chiều dọc (merge cell) và các dòng steps tiếp theo để trống ở các cột này.

---

## Self-Checklist

- [ ] File có đúng 2 sheet: `test_case_{module}` và `rule_{module}`.
- [ ] Sheet `rule_{module}` có đủ thông tin Valid/Invalid cho từng field.
- [ ] `ml_tc_id` liên kết đúng với `hl_tc_id` từ L1.
- [ ] Không để ô trống trong cột steps; cột expected chỉ điền ở các bước kiểm tra (check/verify), các bước hành động thông thường để trống.
- [ ] File lưu tại: `data/{Project}/L2_Mid_Level/ML_TC_{catalog_no}_{Module}.xlsx`.
