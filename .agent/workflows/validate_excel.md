---
description: Kiểm tra toàn diện file Excel L3 Master theo EXCEL_CONVENTIONS và báo cáo mọi lỗi format, ô trống, sai chuẩn đặt tên.
skills: []
---

# Workflow: Validate File Excel (`/validate-excel`)

> **BẮT BUỘC:** Đọc kỹ quy chuẩn tại [excel_conventions.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/excel_conventions.md) trước khi bắt đầu kiểm tra.

Workflow này thực hiện kiểm tra chất lượng toàn diện file Excel L3 Master trước khi đưa vào chạy thật, đảm bảo mọi sheet đều đúng chuẩn format và không có lỗi gây fail khi Engine đọc.

---

## Input cần từ User

| Input | Bắt buộc | Mô tả |
|-------|----------|-------|
| File Excel L3 cần validate | ✅ | Đường dẫn file `Master_Test_Suite_*.xlsx` |
| File Excel L2 gốc | ⚠️ Khuyến nghị | Đường dẫn file `ML_TC_*.xlsx` để đối chiếu độ phủ |
| Module Name (CHỮ HOA) | ✅ | VD: `DANH_GIA_BAN_DAU` |
| File `config/actions.txt` | ✅ | Để verify keyword actions hợp lệ |

---

## Các Bước Thực Hiện

### Bước 1: Kiểm Tra Cấu Trúc File

- [ ] File có đúng **3 sheet** không?
  - `ELEMENT_{MODULE}` ✅ / ❌
  - `DATA_{MODULE}` ✅ / ❌
  - `TEST_CASE_{MODULE}` ✅ / ❌
- [ ] Tên sheet dùng đúng tên MODULE không (không có khoảng trắng, không có ký tự đặc biệt)?

### Bước 2: Validate Sheet ELEMENT_{MODULE}

Kiểm tra từng dòng:

| Cột | Quy tắc kiểm tra | Mức độ |
|-----|-----------------|--------|
| `element_id` | Đúng prefix: `txt_`, `btn_`, `ddl_`, `chk_`, `rad_`, `lbl_`, `lnk_`, `error_`, `toast`, `modal_`, `tbl_`, `tab_` | ERROR |
| `element_id` | Unique trong toàn sheet (không có ID trùng) | ERROR |
| `locator_type` | Chỉ dùng: `data-testid`, `id`, `css`, `xpath`, `label`, `placeholder`, `text`, `role` | ERROR |
| `locator_value` | Không rỗng | ERROR |
| `locator_value` | Không chứa CSS class hash (chuỗi ngẫu nhiên như `-abc123-`) | WARN |
| `locator_type` | Nếu có `data-testid` mà đang dùng `id` hay `css` → nên ưu tiên `data-testid` | WARN |
| `description` | Không rỗng (mô tả Tiếng Việt) | WARN |

### Bước 3: Validate Sheet DATA_{MODULE}

Kiểm tra từng dòng:

| Cột | Quy tắc kiểm tra | Mức độ |
|-----|-----------------|--------|
| Mọi ô | **Không có ô trống** — phải là `n/a` hoặc `empty` | ERROR |
| `test_case_id` | Đúng format: `TC_POS_xxx`, `TC_BVA_xxx`, `TC_NEG_xxx`, `TC_EDGE_xxx` | ERROR |
| `test_case_type` | Chỉ dùng: `positive`, `boundary`, `negative`, `edge_case` | ERROR |
| Tổng hợp | Có đủ 4 loại `test_case_type` không? | WARN |
| Giá trị data | Không phải mô tả chung ("giá trị hợp lệ", "valid data"...) | WARN |
| Trường unique | Các trường cần unique (email, mã KH...) có dùng timestamp/random không? | WARN |

### Bước 4: Validate Sheet TEST_CASE_{MODULE}

Kiểm tra từng dòng:

| Cột | Quy tắc kiểm tra | Mức độ |
|-----|-----------------|--------|
| `action` | Chỉ dùng keyword có trong `config/actions.txt` | ERROR |
| `target` | Phải tồn tại trong sheet ELEMENT (hoặc là `precondition/navigate` không cần target) | ERROR |
| `expected` | Không rỗng với bước `check_status` | ERROR |
| `value` | Tham chiếu data dùng đúng syntax: `$data_{MODULE}.{column}` | WARN |
| Test case đầu tiên | Phải có bước `pre_login` ở đầu mỗi test case | WARN |
| Hard sleep | Không có `action=wait_for` với `value={số}` (millisecond tĩnh) | ERROR |

### Bước 5: Kiểm Tra Độ Phủ L2 (L2 Coverage Check)

Nếu có file Excel L2 gốc được cung cấp:

- [ ] Trích xuất toàn bộ danh sách `ml_tc_id` có trong sheet `test_case_{module}` của file L2.
- [ ] So khớp với cột `ml_tc_id` trong sheet `TEST_CASE_{MODULE}` của L3.
- [ ] Mọi `ml_tc_id` trong L2 bắt buộc phải xuất hiện ít nhất 1 lần trong L3. Nếu thiếu bất kỳ ID nào → **ERROR**.
- [ ] Kiểm tra các test case L3 có bám sát luồng đi nghiệp vụ gốc và tuần tự các bước trong L2 không → **WARN** nếu có sự sai lệch lớn.

### Bước 6: Báo Cáo Kết Quả

Trình bày bảng tổng kết theo format:

```
📋 VALIDATION REPORT — {TÊN FILE EXCEL}
═══════════════════════════════════════════
Ngày kiểm tra: {DATE}
Module: {MODULE_NAME}

SHEET ELEMENT_{MODULE}:
  ❌ ERROR (phải fix ngay):
     - Dòng 5: element_id "input_weight" → sai prefix, phải là "txt_weight"
     - Dòng 12: locator_value rỗng
  ⚠️ WARN (nên fix):
     - Dòng 8: đang dùng css nhưng element có data-testid → nên ưu tiên data-testid
  ✅ OK: 15/17 dòng hợp lệ

SHEET DATA_{MODULE}:
  ❌ ERROR:
     - Dòng 3: ô B3 bị trống → thay bằng n/a hoặc empty
  ⚠️ WARN:
     - Chưa có test case loại edge_case
  ✅ OK: 28/30 ô hợp lệ

SHEET TEST_CASE_{MODULE}:
  ❌ ERROR:
     - Dòng 7: action="wait_ms" không tồn tại trong actions.txt
     - Dòng 15: target="btn_submit" không có trong ELEMENT sheet
  ✅ OK: 45/47 bước hợp lệ

ĐỘ PHỦ L2 (TRACEABILITY CHECK):
  ❌ ERROR:
     - Thiếu kịch bản L2 "ML_9.1.2_005" chưa được phân rã ở L3
     - Thiếu kịch bản L2 "ML_9.1.2_018" chưa được phân rã ở L3
  ✅ OK: Đã cover 43/45 kịch bản L2 (95.5%)

═══════════════════════════════════════════
TỔNG KẾT:
  ❌ ERROR: 4 lỗi (BẮT BUỘC sửa trước khi chạy)
  ⚠️ WARN:  3 cảnh báo (nên sửa để đảm bảo chất lượng)
  ✅ OK:    88/94 điểm kiểm tra hợp lệ (93.6%)
═══════════════════════════════════════════
```

---

## Điều Kiện Hoàn Thành

- [ ] Đã kiểm tra đủ cả 3 sheet.
- [ ] Báo cáo phân biệt rõ ERROR và WARN.
- [ ] Có gợi ý fix cụ thể cho từng lỗi ERROR.
- [ ] Nếu có ERROR → KHÔNG cho phép chạy test suite cho đến khi fix xong.
