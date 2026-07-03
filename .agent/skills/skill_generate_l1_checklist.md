---
name: generate_l1_checklist
description: Kỹ năng phân tích tài liệu BRD hoặc quét trực tiếp URL trang web thật để phân rã toàn bộ tính năng, form nhập liệu, nút hành động, màn hình chi tiết và sinh ra file Excel L1 Checklist chuẩn hóa.
---

# Kỹ năng Sinh L1 Checklist (Generate L1 Checklist)

Kỹ năng này hướng dẫn AI Agent cách chuyển đổi giao diện UI thực tế hoặc tài liệu BRD thành file Excel **`HL_FR_{Module_Name}.xlsx`** chuẩn — liệt kê toàn bộ phạm vi kiểm thử (forms, action buttons, view details, popups) theo đúng cấu trúc cột của dự án.

---

## 1. Mục tiêu cốt lõi
- Bóc tách toàn bộ phạm vi kiểm thử (Testing Scope) từ giao diện thực tế: forms nhập liệu, nút hành động, popup/modal, màn hình xem chi tiết.
- Đảm bảo **không bỏ sót** bất kỳ tính năng nào có thể kiểm thử được (In-scope).
- Xác định chính xác UI elements liên quan (`[o]_components`) để dùng trực tiếp ở bước sinh L2 tiếp theo.
- Lưu kết quả đúng định dạng Excel theo cấu trúc đã chuẩn hóa.

---

## 2. Đầu vào (Inputs)
Yêu cầu ít nhất một trong các đầu vào sau:
1. **URL trang web thật**: Địa chỉ màn hình cần phân tích (ví dụ: màn hình Đánh giá ban đầu trước tiêm).
2. **Tài liệu BRD/Yêu cầu nghiệp vụ**: Dạng text, markdown, PDF, hoặc mô tả chi tiết từ người dùng.
3. **Tên Module & Project**: Lấy từ `config/project.yaml` để xác định thư mục đích lưu file đầu ra.

---

## 3. Quy trình trích xuất thông tin

### Bước 3.1: Mở và chụp giao diện (UI Discovery)
Nếu đầu vào là URL:
1. `navigate` đến URL được cung cấp.
2. `resize` màn hình về kích thước desktop chuẩn **`1920×1080`**.
3. Đợi trang load hoàn tất, sau đó `snapshot` DOM.
4. `screenshot` màn hình để lưu làm bằng chứng tham chiếu.
5. Nếu cần, scroll hoặc mở popup/modal/tab để quét các thành phần ẩn.

Nếu đầu vào là BRD:
1. Đọc toàn bộ tài liệu và trích xuất danh sách UI Mockup, luồng nghiệp vụ.

---

### Bước 3.2: Phân rã tính năng (Feature Decomposition)

Phân tích DOM và giao diện theo cấu trúc phân cấp từ lớn → nhỏ:

**A. Tổng quan màn hình (Screen Overview)**
- Tên màn hình, mục đích nghiệp vụ, vai trò người dùng tương tác.

**B. Thu thập tất cả Forms & Input Fields**
- Tìm các `<input>`, `<select>`, `<textarea>`, `<datepicker>`, `<autocomplete>`.
- Ghi nhận `type`, `required`, `maxlength`, `pattern`, placeholder.
- Nhóm các trường nhập liệu liên quan thành 1 Form.

**C. Thu thập tất cả Action Buttons**
- Xác định từng nút: Save, Cancel, Add, Edit, Delete, Search, Filter, Export, Approve, Reject, Submit…
- Ghi nhận trạng thái nút (enabled/disabled theo điều kiện giao diện).

**D. Thu thập View Detail / Popups / Modals**
- Xác định các link/icon dẫn đến màn hình xem chi tiết.
- Xác định các popup/modal được mở khi click nút hoặc row trong bảng danh sách.

**E. Thu thập Bộ lọc & Tìm kiếm (Filters & Search)**
- Xác định các dropdown lọc, input tìm kiếm, bộ lọc kết hợp.

**F. Validation & Toast Messages**
- Xác định các vùng hiển thị lỗi validation (`error_xxx`) và toast thông báo thành công/thất bại (`toast_success`, `toast_error`).

---

### Bước 3.3: Điền giá trị các cột đầu ra phân tích (`[o]_*`)

Đối với từng dòng checklist, AI Agent phải tự động xác định:

| Cột | Cách điền |
| :--- | :--- |
| `[o]_components` | Liệt kê các `element_id` dự kiến tương tác, viết cách nhau bởi dấu phẩy. Đặt tên theo quy chuẩn prefix trong [excel_conventions.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/excel_conventions.md). |

---

### Bước 3.4: Sinh file Excel L1_Checklist

1. Tạo file Excel mới.
2. Tạo đúng **1 sheet** tên là **`Sheet1`**.
3. Ghi dữ liệu với đúng **7 cột** theo thứ tự sau:

| FR | YC | summary | hl_tc_id | [o]_components |

**Quy tắc đặt giá trị từng cột:**
- **`FR`**: Mã chức năng dạng phân cấp, ví dụ `FR-9.1`, `FR-9.1.1`.
- **`YC`**: Mã yêu cầu chi tiết, ví dụ `YC-016`.
- **`summary`**: Mô tả tính năng/nút/form rõ ràng. **Ví dụ:** `Form nhập thông tin sinh hiệu`, `Nút Lưu kết quả`, `Popup xem lịch sử tiêm`.
- **`hl_tc_id`**: ID High-Level Test Case, dạng `HL_001`, `HL_002` — đánh số tuần tự.
- **`[o]_components`**: Danh sách element_id dự kiến, ví dụ: `txt_weight, txt_height, btn_save`.

4. Lưu file tại: `data/{Project_Name}/L1_High_Level/{Module_Folder}/HL_FR_{Module_Name}.xlsx`
   - Ví dụ: `data/Tiem_Chung/L1_High_Level/9.1_Sang_loc/HL_FR_9.1.2_Danh_Gia_Ban_Dau.xlsx`

---

## 4. Ví dụ đầu ra — Sheet1 (Màn hình Đánh giá ban đầu)

| FR | YC | summary | hl_tc_id | [o]_components |
| :--- | :--- | :--- | :--- | :--- |
| FR-9.1 | YC-016 | Màn hình Đánh giá ban đầu - Layout tổng thể | HL_001 | txt_search_keyword, tbl_patient_list |
| FR-9.1.1 | YC-016 | Form nhập thông tin sinh hiệu | HL_001 | txt_weight, txt_height, txt_temp, txt_pulse, txt_spo2 |
| FR-9.1.2 | YC-016 | Form khai báo tiền sử dị ứng | HL_001 | chk_has_allergy, txt_allergy_name |
| FR-9.1.3 | YC-016 | Nút hành động "Lưu kết quả" | HL_001 | btn_save, toast_success, toast_error |
| FR-9.1.4 | YC-017 | Nút hành động "Hủy kết quả" | HL_002 | btn_cancel |
| FR-9.1.5 | YC-018 | Popup xem chi tiết lịch sử tiêm của bệnh nhân | HL_003 | lnk_view_history, modal_history, tbl_history_list |
| FR-9.1.6 | YC-019 | Bộ lọc danh sách bệnh nhân | HL_004 | ddl_filter_status, ddl_filter_vaccine, btn_search |

---

## Strict Rules

### L1-01
Luôn viết mô tả kịch bản (`summary`) bằng **Tiếng Việt**, các định danh kỹ thuật (`element_id` trong cột `[o]_components`) bằng **Tiếng Anh**.

### L1-02
Tuyệt đối **không được tự đoán mò** `element_id`. Bắt buộc phải căn cứ và phân tích dựa trên DOM snapshot thực tế của trang web hoặc tài liệu yêu cầu BRD chính thức.

### L1-03
Nếu giao diện có các tính năng bắt buộc phải can thiệp phần cứng (như quét Barcode) hoặc không thể tự động hóa giả lập (OTP, CAPTCHA), **phải ghi rõ vào cột `summary`** kèm theo chú thích `[Out-of-scope]` và để giá trị cột `[o]_components` là `n/a`.

### L1-04
Không tự ý suy diễn hoặc giả định các yêu cầu nghiệp vụ phức tạp nếu không có căn cứ từ UI hoặc BRD. Trường hợp thiếu thông tin, bắt buộc phải đặt câu hỏi làm rõ với người dùng trước khi ghi nhận vào file Excel.

---

## Checklist tự kiểm tra (Self-Checklist)

- [ ] File Excel có đúng 1 sheet tên `Sheet1` và đúng 5 cột theo thứ tự chuẩn.
- [ ] Mọi form nhập liệu đều đã được liệt kê thành dòng riêng biệt.
- [ ] Mọi action button chính (Save, Cancel, Add, Edit, Delete, Search...) đều có dòng riêng trong checklist.
- [ ] Mọi popup/modal/view detail đều đã được phát hiện và liệt kê.
- [ ] Cột `[o]_components` không bỏ sót element_id nào, tên element tuân thủ đúng tiền tố prefix.
- [ ] File được lưu đúng cấu trúc: `L1_High_Level/{Module_Folder}/` và đúng quy tắc đặt tên `HL_FR_{Module_Name}.xlsx`.
