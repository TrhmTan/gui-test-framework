---
description: Quét URL trang web thực tế và sinh ra file Excel TC High Level (L1 Checklist) chuẩn hóa cho dự án unified-gui-testing-tool.
skills:
  - generate_l1_checklist
---

# STEP 1 — Sinh TC High Level từ Website (`/tc-high-level`)

> **BẮT BUỘC:**
> 1. Nạp và đọc kỹ skill **`generate_l1_checklist`** tại [.agent/skills/skill_generate_l1_checklist.md](../skills/skill_generate_l1_checklist.md) trước khi bắt đầu.
> 2. Đọc kỹ quy tắc chung tại [automation_rules.md](../rules/automation_rules.md).

**Vị trí trong flow:** 🌐 URL → **[STEP 1 TC HIGH LEVEL]** → Step 2 Mid Level → Step 3 Low Level

Workflow này phân tích giao diện thực tế của một module/trang web và sinh ra file Excel **`HL_FR_{catalog_no}_{Module}.xlsx`** — danh sách phạm vi kiểm thử đầy đủ theo đúng chuẩn của dự án.

> 📌 **`{catalog_no}` là số danh mục** trong cấu trúc phân cấp nghiệp vụ — **không phải version phần mềm**.
> ```
> 9.1 Sàng lọc
>      9.1.1 Điều phối
>      9.1.2 Đánh giá ban đầu
>      9.1.3 Khám sàng lọc       ← catalog_no = 9.1.3
> 9.2 Tiêm chủng
>      9.2.1 Danh sách chờ tiêm  ← catalog_no = 9.2.1
> ```
> → File L1 cho mục 9.1.3: `HL_FR_9.1.3_Kham_Sang_Loc.xlsx`


---

## Input cần từ User

| Input | Bắt buộc | Mô tả |
|-------|----------|-------|
| URL trang web | ✅ | URL màn hình cần phân tích |
| Tên Project | ✅ | Lấy từ `config/project.yaml`. VD: `Tiem_Chung` |
| Tên Module | ✅ | VD: `Kham_Sang_Loc` |
| Số danh mục (catalog_no) | ✅ | Số thứ tự phân cấp nghiệp vụ. VD: `9.1.3` (không phải version phần mềm) |
| Tên thư mục nhóm | ✅ | Tên thư mục cha chứa module. VD: `9.1_Sang_loc` |
| Thông tin đăng nhập | ⚠️ Nếu cần | Lấy từ `config/credentials.env` |


---

## Các Bước Thực Hiện

### Bước 1: Đọc cấu hình dự án

```yaml
# Đọc config/project.yaml để xác định:
- base_url của dự án
- module_folder tương ứng
- đường dẫn L1 đích: data/{Project}/L1_High_Level/{Module_Folder}/
```

### Bước 2: Mở và Khảo sát UI

```
navigate  → URL trang cần phân tích
resize    → 1920x1080 (BẮT BUỘC)
wait_for  → page load hoàn tất
snapshot  → chụp DOM đầy đủ
screenshot→ lưu tại screenshots/L1/{MODULE}/overview.png
```

Nếu trang yêu cầu đăng nhập → thực hiện login trước bằng `config/credentials.env`.

Scroll qua toàn bộ trang để phát hiện tất cả thành phần ẩn (lazy-load, tab ẩn, modal).

### Bước 3: Phân Rã Tính Năng

Quét theo thứ tự:

**A. Forms & Input Fields** → mỗi form = 1 nhóm dòng trong L1
**B. Action Buttons** (Save, Cancel, Add, Edit, Delete, Search...) → mỗi button = 1 dòng
**C. View Detail / Popups / Modals** → mỗi modal = 1 dòng
**D. Filters & Search** → mỗi bộ lọc = 1 dòng
**E. Validation & Toast Messages** → ghi nhận để làm đầu vào cho các bước tiếp theo
**F. Bảng danh sách (Table/Grid)** → 1 dòng riêng

### Bước 4: CHECKPOINT — Xác Nhận Phạm Vi ⏸️

Trình bày danh sách tính năng phát hiện được cho User xác nhận trước khi ghi vào Excel:

```
✅ Sẽ đưa vào L1:
  - Form nhập thông tin sinh hiệu (cân nặng, chiều cao, nhiệt độ...)
  - Nút Lưu kết quả
  - Nút Hủy
  - Popup xem lịch sử tiêm

❓ Cần xác nhận:
  - Chức năng scan QR code → có trong phạm vi test không?

❌ Out-of-scope (đề xuất):
  - Màn hình in phiếu → phụ thuộc phần cứng máy in
```

Chờ User xác nhận trước khi sang Bước 5.

### Bước 5: Sinh File Excel L1

Tạo file với đúng **1 sheet** tên `Sheet1` và **5 cột** theo thứ tự:

| FR | YC | summary | hl_tc_id | [o]_component |
|:---|:---|:--------|:---------|:--------------|

Quy tắc điền:
- `summary`: Tiếng Việt, mô tả rõ tính năng.
  - **Bắt buộc về dấu so sánh (Quy tắc BVA-04)**: Tuyệt đối không sử dụng các dấu so sánh nghiêm ngặt `<` hoặc `>` trong cột `summary`. Yêu cầu diễn đạt bằng dấu `<=`, `>=` tương ứng (ví dụ: ghi `trẻ <= 35 tháng` thay vì `trẻ < 36 tháng`, `trẻ <= 5 tuổi` thay vì `trẻ < 6 tuổi`).
- `hl_tc_id`: Đánh số tăng dần liên tục dạng `HL_{catalog_no}_{Sequence}` (Ví dụ: `HL_9.1.2_001`, `HL_9.1.2_002`, `HL_9.1.2_003`... tăng dần từ 001 đến hết file Excel, bất kể thuộc component nào).
- `[o]_component`: Phân chia test case theo nhóm tính năng/vùng chức năng chính trên giao diện. Viết bằng tiếng Anh không dấu, dạng snake_case hoặc CamelCase.
  - Ví dụ đối với màn hình 9.1.2 Đánh giá ban đầu, các component chính:
    - `Tiep_Don_Vang_Lai`: Các test case liên quan đến form "Tiếp đón khách vãng lai".
    - `Danh_Sach_Khach_Hang`: Các test case liên quan đến bảng danh sách khách hàng, tìm kiếm (search), và bộ lọc (filter).
    - `Do_Chi_So_Sinh_Hieu`: Các test case liên quan đến Form đo chỉ số chi tiết khách hàng và chuyển đổi trạng thái.

Lưu file tại:
```
data/{Project}/L1_High_Level/{catalog_no}_{Module_Group}/HL_FR_{catalog_no}_{Module_Name}.xlsx

Ví dụ thực tế:
  data/Tiem_Chung/L1_High_Level/9.1_Sang_loc/HL_FR_9.1.3_Kham_Sang_Loc.xlsx
  data/Tiem_Chung/L1_High_Level/9.2_Tiem_Chung/HL_FR_9.2.1_Ds_Cho_Tiem.xlsx
```

---

## Điều Kiện Hoàn Thành

- [ ] Đã `navigate` + `resize` 1920x1080, quét DOM thực tế.
- [ ] Tất cả forms, buttons, modals, filters đã được liệt kê.
- [ ] User đã xác nhận phạm vi (Bước 4).
- [ ] File Excel có đúng 1 sheet `Sheet1` với 5 cột.
- [ ] File được lưu đúng cấu trúc: `L1_High_Level/{catalog_no}_{Module_Group}/HL_FR_{catalog_no}_{Module_Name}.xlsx`
  - VD: `L1_High_Level/9.1_Sang_loc/HL_FR_9.1.3_Kham_Sang_Loc.xlsx`
