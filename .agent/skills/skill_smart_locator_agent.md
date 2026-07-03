---
name: smart_locator_agent
description: Skill sinh locator ổn định và dễ bảo trì cho Excel sheet ELEMENT_{MODULE} trong framework unified-gui-testing-tool. Ưu tiên data-testid là hàng đầu.
---

# Smart Locator Agent

**Mục đích:** Quét DOM thực tế của trang web và sinh ra danh sách locator chuẩn hóa để điền vào sheet `ELEMENT_{MODULE}` trong file Excel L3 Master, theo đúng thứ tự ưu tiên locator của dự án.

---

## When to Use

Sử dụng skill này khi:
- Tạo mới module test → cần điền sheet `ELEMENT_{MODULE}` từ đầu
- UI thay đổi → cần cập nhật locator bị hỏng (xem thêm: `/update-element`)
- Review lại locator hiện có để kiểm tra tính ổn định

---

## Responsibilities

Agent phải thực hiện theo đúng thứ tự:
1. **Inspect** — Quét DOM thực tế (KHÔNG ĐƯỢC đoán mò)
2. **Identify** — Xác định attributes ổn định của từng element
3. **Generate** — Sinh locator theo thứ tự ưu tiên
4. **Validate** — Kiểm tra locator match đúng 1 element duy nhất
5. **Output** — Ghi vào bảng ELEMENT_{MODULE} đúng format Excel

---

## Locator Priority & Strategy

> [!IMPORTANT]
> Mọi locator được sinh ra phải tuân thủ nghiêm ngặt **Bản đồ ưu tiên**, **Quy tắc ổn định**, **Cách ghi Excel** và **Ánh xạ sang Playwright code**.
> Đọc toàn bộ chi tiết tại: [locator_strategy.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/locator_strategy.md) *(Single Source of Truth — không lặp lại ở đây)*.

---

## Execution Steps

### Bước 1: Mở và quét trang

```
navigate → URL trang cần quét
resize → 1920x1080
wait_for → page load hoàn tất
snapshot → chụp DOM
screenshot → lưu bằng chứng
```

### Bước 2: Quét tất cả elements tương tác

Tìm kiếm trong DOM theo thứ tự:

**Nhóm Input:**
- `input`, `textarea`, `select` → prefix `txt_` hoặc `ddl_`
- Kiểm tra thuộc tính: `data-testid`, `id`, `name`, `placeholder`, `aria-label`

**Nhóm Button:**
- `button`, `[type="submit"]`, `[role="button"]`, `a` (hành động) → prefix `btn_`
- Kiểm tra thuộc tính: `data-testid`, `id`, `aria-label`, text content

**Nhóm Hiển thị / Phản hồi:**
- Toast notifications → prefix `toast`
- Error messages / Validation messages → prefix `error_`
- Label tĩnh → prefix `lbl_`

**Nhóm Điều hướng:**
- Modal / Popup → prefix `modal_` hoặc `dlg_`
- Table → prefix `tbl_`
- Tab → prefix `tab_`

### Bước 3: Sinh locator cho từng element

Với mỗi element tìm được:
1. Kiểm tra có `data-testid` không? → **Dùng ngay**, ghi `locator_type = data-testid`
2. Không có `data-testid` → Kiểm tra `id` → ghi `locator_type = id`
3. Không có cả hai → Dùng `css` với selector ổn định
4. Trường hợp đặc biệt → Playwright semantic (`getByLabel`, `getByPlaceholder`)

### Bước 4: Điền vào bảng ELEMENT

Định dạng output chuẩn cho sheet `ELEMENT_{MODULE}`:

| element_id | locator_type | locator_value | description |
| :--- | :--- | :--- | :--- |
| `btn_save` | `data-testid` | `btn-save-screening` | Nút Lưu kết quả sàng lọc |
| `txt_weight` | `data-testid` | `weight-input` | Ô nhập cân nặng (kg) |
| `ddl_hospital` | `data-testid` | `select-hospital` | Dropdown chọn bệnh viện |
| `error_weight` | `css` | `[data-testid="weight-error"]` | Thông báo lỗi trường cân nặng |
| `toast_success` | `css` | `[data-testid="toast-success"]` | Toast thông báo thành công |
| `btn_login` | `id` | `btn-login` | Nút đăng nhập *(không có data-testid)* |

---

## Strict Rules

### SL-01
Tuyệt đối KHÔNG BAO GIỜ đoán locator. Phải inspect DOM thực tế thông qua snapshot.

### SL-02
Bắt buộc tuân thủ chiến lược chọn locator và quy chuẩn đặt tên được định nghĩa trong [locator_strategy.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/locator_strategy.md) và [excel_conventions.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/excel_conventions.md).

### SL-03
Mỗi `element_id` phải unique trong toàn bộ sheet `ELEMENT_{MODULE}` của module đó.

### SL-04
Nếu một phần tử có trên giao diện nhưng không thể tìm thấy bất kỳ thuộc tính ổn định nào (không có data-testid, không có id, aria-label, name hoặc các thuộc tính text ổn định), **PHẢI báo cáo ngay cho người dùng** để phối hợp với nhà phát triển bổ sung thuộc tính ổn định, tuyệt đối không tự ý điền locator tạm bợ (như class name hash hay xpath tuyệt đối).

---

## Self-Checklist

- [ ] Đã `navigate` và `resize` đúng 1920x1080 trước khi quét.
- [ ] Đã ưu tiên `data-testid` cao nhất — kiểm tra từng element.
- [ ] Mỗi locator đã verify là unique trên trang (không match hơn 1 element).
- [ ] Tất cả `element_id` viết đúng prefix (`txt_`, `btn_`, `ddl_`, `error_`, `toast`...).
- [ ] Cột `description` điền tiếng Việt, mô tả chức năng của element.
- [ ] KHÔNG có locator XPath tuyệt đối hoặc CSS class hash trong bảng.
