---
description: Khởi tạo cấu trúc thư mục và template Excel cho module/màn hình mới.
skills: []
---

# STEP 0 — Khởi Tạo Module Mới (`/init-module`)

> Workflow này giúp người dùng chuẩn bị cấu trúc thư mục và file Excel template
> trước khi bắt đầu flow sinh test case (Step 1 → 2 → 3).

**Vị trí trong flow:** **[STEP 0 INIT]** → Step 1 High Level → Step 2 Mid Level → Step 3 Low Level

---

## Input cần từ User

| Input | Bắt buộc | Mô tả |
|-------|----------|-------|
| MODULE | ✅ | Tên module (= project_name). VD: `Tiem_Chung` |
| SCREEN | ✅ | Tên màn hình cần test. VD: `Kham_Sang_Loc` |
| CATALOG_NO | ✅ | Mã phân cấp nghiệp vụ. VD: `9.1.3` |
| FOLDER_GROUP | ✅ | Tên thư mục nhóm. VD: `9.1_Sang_Loc` |
| URL | ⚠️ Nếu có | URL trang đích để khai báo vào sheet PAGE |

---

## Các Bước Thực Hiện

### Bước 1: Kiểm tra config/project.yaml

1. Đọc file `config/project.yaml`.
2. Kiểm tra `project_name` có khớp với MODULE không.
3. Nếu đổi module mới → hướng dẫn user cập nhật 2 file:
   - `config/project.yaml` (project_name, base_url, data_dir)
   - `config/credentials.env` (tài khoản đăng nhập)

### Bước 2: Tạo cấu trúc thư mục

Tạo các thư mục nếu chưa tồn tại:

```
data/{MODULE}/
├── L1_High_Level/
│   └── {CATALOG_NO}_{FOLDER_GROUP}/
├── L2_Mid_Level/
│   └── {CATALOG_NO}_{FOLDER_GROUP}/
└── L3_Low_Level/
    └── {CATALOG_NO}_{FOLDER_GROUP}/
```

### Bước 3: Tạo file JSON dropdown (nếu cần)

Nếu màn hình có dropdown, tạo file config nếu chưa tồn tại:
```
config/dropdown_data/{MODULE}/{SCREEN}.json
```

### Bước 4: Xác nhận

Trình bày cấu trúc đã tạo cho User xác nhận:
```
✅ Đã tạo thư mục:
   data/Tiem_Chung/L1_High_Level/9.1_Sang_Loc/
   data/Tiem_Chung/L2_Mid_Level/9.1_Sang_Loc/
   data/Tiem_Chung/L3_Low_Level/9.1_Sang_Loc/

📋 Bước tiếp theo:
   → Chạy STEP 1 (step_01_high_level.txt) để quét URL và sinh L1 Checklist.
```

---

## Điều Kiện Hoàn Thành

- [ ] Thư mục 3 tầng đã được tạo.
- [ ] `config/project.yaml` đã đúng project_name.
- [ ] User đã xác nhận cấu trúc.
