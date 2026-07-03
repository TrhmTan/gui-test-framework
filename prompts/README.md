# Prompt Templates — Hướng Dẫn Sử Dụng

Thư mục này chứa **prompt mẫu** dùng nhanh cho từng bước test automation.

> **Cách dùng:** Mở file `.txt` → điền thông tin vào các dòng `[...]` → copy toàn bộ → paste vào Antigravity chat → gửi.

---

## 🗺️ Flow Tổng Quan

```
[Bước 0] Cấu hình dự án (1 lần duy nhất)
    ↓
[Bước 1] URL → L1 High Level Checklist
    ↓
[Bước 2] L1 → L2 Mid Level Test Plan + Rules
    ↓
[Bước 3] L2 → L3 Master (ELEMENT + DATA + TEST_CASE)
    ↓
[Chạy test] run.bat "tên_file_hoặc_keyword"
    ↓
[Xem kết quả] File Excel (cột [o]_test_result) + Playwright Report
```

---

## 📁 Danh Sách Prompt Theo Thứ Tự

### Flow Chính

| Bước | File | Mục đích | User cần điền |
|------|------|----------|---------------|
| **STEP 0** | `step_00_init_module.txt` | Khởi tạo module mới (tạo thư mục + template) | MODULE, URL |
| **STEP 1** | `step_01_tc_high_level.txt` | Quét URL → sinh L1 Checklist (5 cột) | MODULE, SCREEN, CATALOG_NO, URL |
| **STEP 2** | `step_02_tc_mid_level.txt` | L1 → sinh L2 Test Plan (2 sheet: test_case + rule) | MODULE, SCREEN, CATALOG_NO, URL |
| **STEP 3** | `step_03_tc_low_level.txt` | L2 → sinh L3 Master (3 sheet: ELEMENT + DATA + TEST_CASE) | MODULE, SCREEN, CATALOG_NO, URL |

### Sub-steps (dùng riêng khi cần)

| Bước | File | Mục đích |
|------|------|----------|
| **3a** | `step_03a_element_sheet.txt` | Chỉ quét DOM → sinh sheet ELEMENT |
| **3b** | `step_03b_test_data.txt` | Chỉ sinh test data → sheet DATA |

---

## ⚡ Lưu Ý Quan Trọng

> **CẤU HÌNH**: Đọc `config/project.yaml` để lấy base_url, project_name trước khi điền prompt.

> **LOCATOR**: AI bắt buộc mở browser thật để quét DOM. CẤM đoán mò locator.

> **TEST DATA**: Luôn cụ thể hóa giá trị ("55.5 kg" ✅ | "giá trị hợp lệ" ❌). Không để ô trống trong sheet DATA.
