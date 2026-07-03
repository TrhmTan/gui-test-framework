# Chiến Lược Chọn Locator — unified-gui-testing-tool

> Áp dụng cho mọi tác vụ automation testing trong dự án này.
> Nguyên tắc cốt lõi: **KHÔNG BAO GIỜ** chọn element dựa trên cấu trúc DOM gắn với styling. Hãy xây dựng locator dựa trên thuộc tính có ngữ nghĩa.

---

## 1. Bản Đồ Ưu Tiên (Master Priority Map)

Thứ tự ưu tiên từ cao đến thấp, áp dụng cho mọi thao tác tương tác UI:

| Thứ tự | Loại Locator | Ví dụ cụ thể |
| :--- | :--- | :--- |
| **1 (ƯU TIÊN CAO NHẤT)** | `data-testid` *(yêu cầu BE cung cấp)* | `[data-testid="btn-save"]` |
| **2** | `data-test`, `data-qa` | `[data-test="input-weight"]` |
| **3** | Accessibility / Aria (`aria-label`, `role`) | `[aria-label="Lưu kết quả"]` |
| **4** | `id` attribute | `#btn-login` |
| **5** | `name` attribute | `[name="username"]` |
| **6** | Playwright semantic locator | `getByRole('button', {name: 'Lưu'})` |
| **7** | CSS Selector ổn định | `input[type="email"]` |
| **8 (CUỐI CÙNG)** | XPath | Chỉ dùng khi 7 cái ưu tiên trên không có (hạn chế tối đa) |

> [!IMPORTANT]
> Đối với dự án này: **`data-testid` là locator ưu tiên số 1**. Khi quét DOM và tìm thấy `data-testid`, bắt buộc phải sử dụng, không được dùng locator khác thay thế. Tuyệt đối tránh sử dụng XPath trừ trường hợp bất khả kháng khi không thể định nghĩa được bằng 7 phương pháp trên.

---

## 2. Quy Tắc Ổn Định (Stability Rules)

Mọi locator phải đảm bảo:
- Chỉ match **đúng 1 element** duy nhất trên trang (unique in scope).
- Sống sót qua thay đổi giao diện — không bị ảnh hưởng khi DOM thay đổi layout.

**NGHIÊM CẤM sử dụng:**
- CSS class name động / hash tạm thời (ví dụ: `css-1n2xyz-btn`, `Button-abc123`)
- XPath tuyệt đối theo vị trí (ví dụ: `//div[3]/table/tbody/tr[2]/td[1]`)
- Parent-child chain quá dài hơn 3 cấp

**Quy tắc định vị Nhãn (prefix `lbl_`):**
- Mặc định sử dụng `locator_type` = `text` và `locator_value` = nội dung hiển thị của nhãn (bao gồm ký tự đặc biệt như `*` nếu có).
- Trường hợp nhãn bị trùng lặp trên trang (ví dụ ở trang background phía sau popup), sử dụng kết hợp CSS scope với text (ví dụ: `css` | `[role="dialog"] >> label >> text="Khách hàng"`) để đảm bảo định vị duy nhất.

---

## 3. Quy Tắc Ghi Element vào Sheet ELEMENT_{MODULE}

Cách ghi `locator_type` và `locator_value` vào file Excel:

| element_id | locator_type | locator_value |
| :--- | :--- | :--- |
| `btn_save` | `data-testid` | `btn-save-vital` |
| `txt_weight` | `data-testid` | `weight-input` |
| `ddl_hospital` | `data-testid` | `select-hospital` |
| `toast_success` | `css` | `[data-testid="toast-success"]` |
| `error_weight` | `css` | `[data-testid="weight-error"]` |
| `btn_login` | `id` | `btn-login` *(khi không có data-testid)* |
| `lbl_username` | `css` | `[aria-label="Tên người dùng"]` *(khi không có data-testid và id)* |

---

## 4. Ánh Xạ locator_type → Playwright Code

`LocatorResolver.ts` trong Engine sẽ ánh xạ theo bảng sau:

| `locator_type` trong Excel | Playwright Locator Code được sinh ra |
| :--- | :--- |
| `data-testid` | `page.getByTestId('value')` |
| `id` | `page.locator('#value')` |
| `css` | `page.locator('value')` |
| `xpath` | `page.locator('xpath=value')` |
| `text` | `page.getByText('value')` |
| `placeholder` | `page.getByPlaceholder('value')` |
| `label` | `page.getByLabel('value')` |
| `role` | `page.getByRole('value')` |
