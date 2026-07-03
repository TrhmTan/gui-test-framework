---
description: Tổng hợp kết quả từ playwright-report và sinh báo cáo kiểm thử chuyên nghiệp theo module.
skills: []
---

# Workflow: Sinh Báo Cáo Kiểm Thử (`/gen-report`)

> Workflow này đọc kết quả từ `playwright-report/` và `test-results/`, tổng hợp thành báo cáo kiểm thử rõ ràng, có thể gửi cho team Dev và PO.

---

## Input cần từ User

| Input | Bắt buộc | Mô tả |
|-------|----------|-------|
| Tên Project / Module | ✅ | VD: `Tiem_Chung — 9.1.2 Đánh giá ban đầu` |
| Ngày chạy | ✅ | VD: `2026-06-14` |
| Môi trường | ✅ | VD: `Staging — https://...` |
| Thư mục kết quả | ⚠️ | Mặc định: `playwright-report/` và `test-results/` |

---

## Các Bước Thực Hiện

### Bước 1: Đọc Kết Quả Test

1. Đọc file `playwright-report/index.html` hoặc JSON kết quả trong `test-results/`.
2. Liệt kê tất cả test cases:
   - Test Case ID + Tên
   - Kết quả: PASS ✅ / FAIL ❌ / SKIP ⏭️
   - Thời gian chạy (ms)
   - Tên file screenshot (nếu fail)

### Bước 2: Phân Loại FAIL

Với mỗi test case FAIL, xác định sơ bộ root cause:

| Loại lỗi | Dấu hiệu | Nhãn báo cáo |
|---|---|---|
| Bug thật (nghiệp vụ sai) | Expected result khác với thực tế UI | 🐛 BUG |
| Locator hỏng | TimeoutError, ElementNotFound | 🔧 LOCATOR |
| Môi trường | Connection error, timeout toàn bộ | 🌐 ENV |
| Data sai | Assertion fail do dữ liệu test | 📊 DATA |

### Bước 3: Sinh File Báo Cáo

Tạo file `reports/report_{Module}_{Date}.md` với nội dung:

```markdown
# BÁO CÁO KIỂM THỬ — {MODULE}

**Ngày:** {Date}  |  **Môi trường:** {ENV}  |  **Người thực hiện:** AI Agent

---

## Tổng Quan

| Chỉ số | Số lượng | Tỷ lệ |
|--------|----------|-------|
| Tổng test cases | ? | 100% |
| PASS ✅ | ? | ?% |
| FAIL ❌ | ? | ?% |
| SKIP ⏭️ | ? | ?% |

---

## Test Cases FAIL

| TC ID | Tên | Bước fail | Root Cause | Mức độ |
|---|---|---|---|---|
| TC_POS_001 | Lưu kết quả hợp lệ | Bước 5 - check_status(toast_success) | 🔧 LOCATOR | HIGH |

### Chi tiết từng lỗi:

**TC_POS_001:**
- Bước fail: `check_status(toast_success) expected=visible`
- Error: `TimeoutError: locator not found`
- Root cause: Toast locator đã thay đổi sau UI update
- Gợi ý: Cập nhật locator trong ELEMENT sheet, chạy `/update-element`

---

## Test Cases PASS

(Tóm tắt — danh sách đầy đủ xem playwright-report)
✅ TC_BVA_001 — Nhập cân nặng đúng min (1 kg)
✅ TC_BVA_002 — Nhập cân nặng đúng max (300 kg)
... (N test cases PASS)

---

## Vấn Đề Cần Xử Lý

### 🐛 Bug cần báo Dev (Lỗi nghiệp vụ)
- [Liệt kê nếu có]

### 🔧 Locator cần cập nhật
- TC_POS_001: toast_success → chạy `/update-element` để fix

### 📊 Data cần bổ sung
- [Liệt kê nếu có]

---

## Khuyến Nghị

| Ưu tiên | Hành động |
|---------|-----------|
| 🔴 Critical | Fix locator bị hỏng trước khi re-run |
| 🟡 High | Báo Dev về bug nghiệp vụ (nếu có) |
| 🟢 Medium | Bổ sung test case cho edge case còn thiếu |
```

---

## Điều Kiện Hoàn Thành

- [ ] Đã đọc đầy đủ kết quả từ playwright-report.
- [ ] Bảng tổng quan có đủ: tổng, PASS, FAIL, SKIP và tỷ lệ %.
- [ ] Mọi test case FAIL có ghi root cause và gợi ý fix.
- [ ] File báo cáo được lưu tại `reports/report_{Module}_{Date}.md`.
- [ ] Khuyến nghị ưu tiên theo mức độ Critical → High → Medium.
