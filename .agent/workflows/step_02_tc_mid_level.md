---
description: Sinh file Excel TC Mid Level (L2 Test Plan) từ L1 Checklist — bao gồm sheet test_case_{module} (9 cột) và sheet rule_{module} (validation rules từng field).
skills:
  - l2_test_plan_generator
---

# STEP 2 — Sinh TC Mid Level từ High Level (`/tc-mid-level`)

> **BẮT BUỘC:** Đọc kỹ skill **`l2_test_plan_generator`** tại [.agent/skills/skill_l2_test_plan_generator.md](../skills/skill_l2_test_plan_generator.md) và [excel_conventions.md](../rules/excel_conventions.md) trước khi bắt đầu.

**Vị trí trong flow:** 🌐 URL → Step 1 High Level → **[STEP 2 TC MID LEVEL]** → Step 3 Low Level

Workflow này chuyển hóa L1 Checklist → file Excel **`ML_TC_{catalog_no}_{Module}.xlsx`** với 2 sheet chuẩn: kịch bản test và business rules từng field.

---

## Input cần từ User

| Input | Bắt buộc | Mô tả |
|-------|----------|-------|
| File L1 Checklist | ✅ | Đường dẫn `HL_FR_{catalog_no}_{Module}.xlsx` — VD: `HL_FR_9.1.3_Kham_Sang_Loc.xlsx` |
| URL hệ thống | ✅ | Để verify UI + lấy business rules thực tế |
| Tên Module (snake_case) | ✅ | VD: `kham_sang_loc` |
| Số danh mục (catalog_no) | ✅ | Số phân cấp nghiệp vụ. VD: `9.1.3` |

---

## Các Bước Thực Hiện

### Bước 1: Đọc L1 Checklist

1. Mở file `HL_FR_*.xlsx`, đọc sheet `Sheet1`.
2. Phân nhóm các `hl_tc_id` theo chức năng liên quan.
3. Xác định các trường nhập liệu (form fields) cần kiểm thử thông qua việc khảo sát giao diện thực tế.

* **Ràng buộc URL Scope Lock & Emergency Stop (Khóa cứng Phạm vi & Dừng khẩn cấp) [CRITICAL]:**
  - AI Agent và Browser Subagent chỉ được phép thao tác và quét thông tin trong phạm vi URL đích của màn hình cấu hình trong CONTEXT.
  - **CẤM TUYỆT ĐỐI** click vào Sidebar, Top Navigation Bar, Header hoặc bất kỳ menu/liên kết điều hướng nào có thể chuyển hướng trình duyệt ra ngoài phạm vi màn hình cần quét.
  - **CẤM TUYỆT ĐỐI** tự ý click nút Lưu, Gửi, Ký số hoặc Xác nhận (Submit) các form làm thay đổi dữ liệu thật hoặc kích hoạt chuyển trạng thái trên hệ thống (ví dụ: click Lưu và chuyển bác sĩ), trừ khi được yêu cầu rõ ràng.
  - **CƠ CHẾ DỪNG KHẨN CẤP (Emergency Stop):** Nếu trình duyệt tự động chuyển hướng hoặc click lệch hướng ra ngoài phạm vi URL mục tiêu (như sang trang `/cashier`, `/doctor`...), subagent **bắt buộc phải dừng (STOP) thực thi lập tức**, crash/throw error để trả quyền kiểm soát lại cho người dùng và báo cáo lỗi cho Agent chính. Không được phép tự ý thực hiện tiếp các bước của luồng khác.

```
navigate  → URL màn hình module
resize    → 1920x1080
snapshot  → chụp DOM
```

Với mỗi input field trên form, thu thập:
- Attribute `min`, `max`, `maxlength`, `pattern`, `required`
- Placeholder text, aria-label (để hiểu nghiệp vụ)
- Validation message khi để trống hoặc nhập sai

### Bước 3: CHECKPOINT — Xác Nhận Business Rules ⏸️

Trình bày bảng rules tìm được cho User xác nhận:

```
| Trường thông tin   | Bắt buộc | Kiểu điều khiển | Kiểu dữ liệu | Vùng Hợp Lệ              | Vùng Không Hợp Lệ |
|--------------------|----------|-----------------|--------------|--------------------------|-------------------|
| Cân nặng (weight)  | y        | textbox         | decimal      | 1.0 <= weight <= 300.0   | weight <= 0.9, weight >= 300.1 |
| Chiều cao (height) | y        | textbox         | decimal      | 30.0 <= height <= 250.0  | height <= 29.9, height >= 250.1 |
| Mạch (pulse)       | n        | textbox         | integer      | 30 <= pulse <= 200       | pulse <= 29, pulse >= 201 |
| Phòng chờ (room)   | n        | dropdown list   | string       | = danh sách phòng chờ    | != danh sách phòng chờ |
| Kết luận (conclusion)| y      | dropdown list   | string       | = Đủ điều kiện tiêm chủng, Hoãn tiêm, Chống chỉ định | != Đủ điều kiện tiêm chủng, Hoãn tiêm, Chống chỉ định |
```

> ⚠️ **BẮT BUỘC VỀ DẤU SO SÁNH & TOÁN TỬ**:
> - Tuyệt đối **không** được ghi các dấu so sánh nghiêm ngặt `<` hoặc `>` trong cột "Vùng Không Hợp Lệ". Phải chuyển đổi sang dùng `<=`, `>=` tương ứng dựa trên kiểu dữ liệu và sai số (ví dụ: `weight <= 0.9, weight >= 300.1` thay vì `weight < 1.0 hoặc weight > 300.0`).
> - **CẤM** sử dụng kiểu điều khiển `select` cho dropdown. Bắt buộc dùng `dropdown list`.
> - **CẤM** điền `n/a` hoặc để trống ở Vùng Không Hợp Lệ của dropdown list hay bất kỳ trường nào. Phải mô tả bằng các toán tử `=`, `!=`.
> - Dùng dấu phẩy `,` thay cho từ "hoặc" tiếng Việt để ngăn cách các biên lỗi.

Chờ User bổ sung/sửa trước khi tạo file.

### Bước 4: Sinh Sheet `rule_{module}` (7 cột)

```
Trường thông tin | Bắt buộc (y/n) | Kiểu điều khiển | Kiểu dữ liệu | Vùng Hợp Lệ | Vùng Không Hợp Lệ | Note (TBD/TBU)
```

### Bước 5: Sinh Sheet `test_case_{module}` (9 cột)

Với mỗi `hl_tc_id` từ L1, sinh các test cases:
- **Positive:** Happy path đại diện
- **Negative:** 1 field sai / TC (One-wise)
- **Boundary:** Min/Max cho field có số

Format mỗi kịch bản test case (tách hàng step, không merge cell):
- **Không gộp ô (Merge Cells) & Tránh lặp dữ liệu:** Các cột thông tin chung (FR, YC, hl_tc_id, ml_tc_id, title, preconditions) **chỉ được ghi ở dòng step đầu tiên** của test case đó. Các dòng step tiếp theo thuộc cùng kịch bản bắt buộc phải để trống hoàn toàn ở các cột này (tuyệt đối không sử dụng merge cells và không lặp lại dữ liệu).
- **KHÔNG tạo dòng tóm tắt dư thừa ở đầu:** Dòng đầu tiên chứa thông tin chung (cột A->F) chính là nơi ghi nhận `step 1`.
- **Chỉ ghi expected ở step thực hiện việc kiểm tra (check/verify):** Cột `expected` chỉ ghi kết quả mong đợi ở step thực hiện việc kiểm tra (ví dụ: *check_status*, *check_value*). Các step thực hiện hành động thông thường (như click, input, navigate...) bắt buộc phải để trống cột `expected`.
- **Bắt buộc tham số hóa cột test_data:** Cột `test_data` bắt buộc phải sử dụng tham chiếu biến dạng `$data_{MODULE}.{column_name}` cho từng trường nhập liệu trong các steps, tuyệt đối không được ghi giá trị tĩnh (hardcode) thực tế (Ví dụ: ghi `$data_kham_sang_loc.screening_room` thay vì `"Phòng khám sàng lọc 1"`).

Ví dụ thực tế:
```
FR | YC | hl_tc_id | ml_tc_id | title | preconditions | steps | test_data | expected
FR-9.1.3 | YC-010 | HL_001 | ML_001 | Mở phiếu khám sàng lọc thành công | pre_login_success | 1. navigate | |
| | | | | | | 2. click | |
| | | | | | | 3. check_status | | visible
```

### Bước 6: Lưu File

```
data/{Project}/L2_Mid_Level/{Module_Folder}/ML_TC_{catalog_no}_{Module_Name}.xlsx

Ví dụ thực tế:
  data/Tiem_Chung/L2_Mid_Level/9.1_Sang_loc/ML_TC_9.1.3_Kham_Sang_Loc.xlsx
  data/Tiem_Chung/L2_Mid_Level/9.2_Tiem_Chung/ML_TC_9.2.1_Ds_Cho_Tiem.xlsx
```

---

## Điều Kiện Hoàn Thành

- [ ] File có đúng **2 sheet**: `test_case_{module}` và `rule_{module}`.
- [ ] Sheet `rule_{module}`: đủ 7 cột, có Vùng Hợp Lệ và Vùng Không Hợp Lệ cho mỗi field.
- [ ] `ml_tc_id` liên kết đúng với `hl_tc_id` từ L1 (traceability L1→L2).
- [ ] Test cases có đủ positive, negative, boundary.
- [ ] Không để ô trống trong cột `steps` (chỉ điền cột `expected` ở các bước thực hiện việc kiểm tra, các bước hành động thông thường để trống).
- [ ] File lưu đúng: `L2_Mid_Level/{Module_Folder}/ML_TC_{catalog_no}_{Module_Name}.xlsx`
  - VD: `L2_Mid_Level/9.1_Sang_loc/ML_TC_9.1.3_Kham_Sang_Loc.xlsx`
