# 📊 Excel Conventions — Single Source of Truth

> **Phạm vi:** Mọi file Excel L1/L2/L3 trong framework `unified-gui-testing-tool`.
> **Vai trò:** Đây là **tài liệu gốc duy nhất (Single Source of Truth)** về format Excel. Mọi workflow, skill, và AI Agent **BẮT BUỘC** tuân thủ file này. KHÔNG tự định nghĩa lại cấu trúc cột ở nơi khác.

---

## 📁 PHẦN 1: KIẾN TRÚC 3 TẦNG (ARCH)

| Tầng | File | Mục đích | Thư mục |
|:---|:---|:---|:---|
| **L1** | `HL_FR_{catalog_no}_{Module}.xlsx` | Phạm vi yêu cầu nghiệp vụ | `data/{Project}/L1_High_Level/{group}/` |
| **L2** | `ML_TC_{catalog_no}_{Module}.xlsx` | Test plan + validation rules | `data/{Project}/L2_Mid_Level/{group}/` |
| **L3** | `Master_Test_Suite_{catalog_no}_{Module}.xlsx` | Steps + locators + test data | `data/{Project}/L3_Low_Level/{group}/` |

> **Traceability:** `hl_tc_id` (L1) → `ml_tc_id` (L2) → `ll_tc_id` (L3). Mối quan hệ là **1-N** (1 ID cấp trên phân rã thành N ID cấp dưới).

**`[ARCH-01]`** Mỗi module bắt buộc có đủ 3 tầng file, đặt đúng thư mục.

**`[ARCH-02]`** Các sheet dùng chung (`PAGE`, `PRECONDITION`, `ELEMENT_LOGIN`) quản lý tập trung tại [preconditions.xlsx](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/config/global/preconditions.xlsx).

**`[ARCH-03]`** Format ID bắt buộc:
- L1: `HL_{catalog_no}_{Seq}` → VD: `HL_9.1.2_001`, `HL_9.1.2_002` (tăng liên tục)
- L2: `ML_{catalog_no}_{Seq}` → VD: `ML_9.1.2_001`, `ML_9.1.2_002`
- L3: `LL_{Seq}` → VD: `LL_001`, `LL_002` (hoặc `LL_{catalog_no}_{Seq}` nếu cần truy vết)

---

## 📋 PHẦN 2: L1 HIGH LEVEL TEST CASE — 1 sheet, 5 cột

**`[L1-01]`** File có đúng **1 sheet** tên `Sheet1`, gồm **5 cột** theo thứ tự:

| # | Cột | Mô tả | Ví dụ |
|:--|:---|:---|:---|
| 1 | `FR` | Mã chức năng phân cấp | `FR-9.1.2` |
| 2 | `YC` | Mã yêu cầu chi tiết | `YC-001` |
| 3 | `summary` | Mô tả tính năng cần kiểm thử (Tiếng Việt) | `Verify hiển thị 2 chỉ dấu Có hẹn/Không hẹn` |
| 4 | `hl_tc_id` | ID High-Level, đánh số tăng dần liên tục từ 001 đến hết file | `HL_9.1.2_001` |
| 5 | `[o]_component` | Phân nhóm theo vùng chức năng trên UI (snake_case, Tiếng Anh) | `Tiep_Don_Vang_Lai` |

---

## 📋 PHẦN 3: L2 MID LEVEL TEST CASE — 2 sheet

**`[L2-01]`** File có đúng **2 sheet**: `test_case_{module}` và `rule_{module}` (viết thường).

### Sheet `test_case_{module}` — 9 cột

**`[L2-02]`** Đúng **9 cột** theo thứ tự:

| # | Cột | Mô tả |
|:--|:---|:---|
| 1 | `FR` | Mã chức năng (từ L1) |
| 2 | `YC` | Mã yêu cầu (từ L1) |
| 3 | `hl_tc_id` | ID High-Level (từ L1) |
| 4 | `ml_tc_id` | ID Mid-Level mới. VD: `ML_9.1.2_001` |
| 5 | `title` | Tên kịch bản (Tiếng Việt) |
| 6 | `preconditions` | Precondition ID. VD: `pre_super_admin_login_success` |
| 7 | `steps` | Bước thực hiện (ngôn ngữ tự nhiên hoặc keyword) |
| 8 | `test_data` | Tham chiếu biến `$data_{MODULE}.{column}`. **CẤM** hardcode giá trị |
| 9 | `expected` | Kết quả mong đợi. Chỉ điền ở step kiểm tra (check/verify) |

**`[L2-03]`** CẤM merge cell. Khi TC có nhiều steps: cột 1–6 chỉ ghi ở dòng step đầu tiên, các dòng sau để trống.

### Sheet `rule_{module}` — 7 cột

**`[L2-04]`** Đúng **7 cột** theo thứ tự:

| # | Cột | Mô tả | Ví dụ |
|:--|:---|:---|:---|
| 1 | `Trường thông tin` | Tên field + tên cột data trong `()` | `Cân nặng (weight)` |
| 2 | `Bắt buộc (y/n)` | `y` hoặc `n` | `y` |
| 3 | `Kiểu điều khiển` | `textbox`, `dropdown list`, `textarea`, `checkbox`, `radio`. **CẤM** ghi `select` | `dropdown list` |
| 4 | `Kiểu dữ liệu` | `float`, `int`, `string` | `float` |
| 5 | `Vùng Hợp Lệ` | Dùng toán tử `>=`, `<=`, `=` | `1.0 <= weight <= 300.0` |
| 6 | `Vùng Không Hợp Lệ` | Dùng toán tử `<=`, `>=`, `!=`. Ngăn cách bằng `,` | `weight <= 0.9, weight >= 300.1` |
| 7 | `Note (TBD/TBU)` | Ghi chú nghiệp vụ | `Làm tròn 1 chữ số` |

**Quy tắc cột 5–6:**
- **CẤM** dùng `<` hoặc `>` (phải dùng `<=`, `>=` + sai số ε)
- **CẤM** điền `n/a` hoặc để trống cột Vùng Không Hợp Lệ
- **CẤM** dùng từ "hoặc" → dùng dấu `,`
- Dropdown: dùng `= val1, val2...` và `!= val1, val2...`

---

## 📁 PHẦN 4: L3 LOW LEVEL TEST CASE — 3 sheet (+ sheet PRECONDITION tùy chọn)

**`[L3-01]`** File có **3 sheet bắt buộc**: `ELEMENT_{MODULE}`, `DATA_{MODULE}`, `TEST_CASE_{MODULE}` (tên sheet viết HOA, module viết đúng format đăng ký).

**`[L3-01b]`** File L3 **có thể** chứa thêm sheet `PRECONDITION` cục bộ nếu module có các kịch bản tiền đề riêng (ngoài preconditions.xlsx toàn cục).

---

### Sheet `ELEMENT_{MODULE}` — 3 hoặc 4 cột

**`[L3-02]`** Cấu trúc cột:

| # | Cột | Bắt buộc | Mô tả | Ví dụ |
|:--|:---|:---:|:---|:---|
| 1 | `element_id` | ✅ | Định danh phần tử (snake_case + prefix chuẩn Phần 5) | `txt_weight` |
| 2 | `locator_type` | ✅ | Loại selector Playwright | `data-testid` |
| 3 | `locator_value` | ✅ | Giá trị selector thực tế | `weight-input` |
| 4 | `description` | ⚠️ | Mô tả chức năng (Tiếng Việt). Khuyến khích có nhưng không bắt buộc | `Ô nhập cân nặng` |

**Giá trị hợp lệ cho `locator_type`:** `data-testid`, `id`, `css`, `xpath`, `text`, `placeholder`, `label`, `role`.

> [!IMPORTANT]
> **Quy tắc chọn Locator:** AI / Automation Engineer (AP) **BẮT BUỘC** phải tuân thủ đúng thứ tự ưu tiên của chiến lược chọn locator. Bắt lấy đúng độ ưu tiên `data-testid` đầu tiên, **KHÔNG** bắt theo `xpath` trừ khi không còn cách nào khác.
> Chi tiết xem tại tài liệu: [locator_strategy.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/locator_strategy.md).


---

### Sheet `DATA_{MODULE}` — cột đầu `test_case_type` + N cột tham số

**`[L3-03]`** Cấu trúc:

| Vị trí | Cột | Mô tả |
|:---|:---|:---|
| Đầu tiên | `test_case_type` | Mã ngắn khớp 1:1 với cột `type` trong TEST_CASE |
| Giữa | `{param_name}` (N cột) | Tên tham số viết snake_case. VD: `weight`, `height` |
| Cuối | `notes` | Mô tả ý đồ kiểm thử (tùy chọn) |

**Format `test_case_type`:**
```
pos_001        — Positive (happy path)
neg_001        — Negative (validation lỗi)
boundary_001   — Biên (BVA)
edge_001       — Đặc biệt
walkin_ll_007  — Kịch bản đặc thù (custom prefix)
```

> [!IMPORTANT]
> **Cơ chế Iteration:** Nếu sheet DATA có nhiều dòng cùng `test_case_type` (VD: 3 dòng `neg_004`), Engine tự động chạy lặp (iter-1, iter-2, iter-3) qua từng dòng cho TC có `type = neg_004`.

---

### Sheet `TEST_CASE_{MODULE}` — 21 cột

**`[L3-04]`** Đúng **21 cột** theo thứ tự chính xác sau (đã xác minh từ file Excel thực tế):

| # | Cột | Ghi ở dòng | Mô tả |
|:--|:---|:---:|:---|
| 1 | `FR` | Đầu TC | Mã chức năng (từ L1) |
| 2 | `YC` | Đầu TC | Mã yêu cầu (từ L1) |
| 3 | `hl_tc_id` | Đầu TC | ID High-Level (từ L1) |
| 4 | `ml_tc_id` | Đầu TC | ID Mid-Level (từ L2) |
| 5 | `ll_tc_id` | Đầu TC | ID Low-Level (khóa chính). VD: `LL_001` |
| 6 | `is_run` | Đầu TC | `ON` = chạy, `OFF` = bỏ qua |
| 7 | `added_manually` | Đầu TC | `Y` = QA thêm tay, `N` = AI sinh tự động |
| 8 | `summary` | Đầu TC | Tên test case (Tiếng Việt) |
| 9 | `type` | Đầu TC | Mã ngắn khớp `test_case_type` trong DATA. VD: `pos`, `neg_004` |
| 10 | `parameterized` | Đầu TC | `Y` = dùng biến $data_, `N` = không |
| 11 | `precondition` | Đầu TC | Precondition ID. VD: `pre_super_admin_login_success` |
| 12 | `step` | Mọi dòng | Số thứ tự bước: `1`, `2`, `3`... |
| 13 | `action` | Mọi dòng | Keyword hành động (xem Phần 9) |
| 14 | `target` | Mọi dòng | `element_id` hoặc `page_key` |
| 15 | `value` | Mọi dòng | Giá trị nhập hoặc `$data_{MODULE}.{col}` |
| 16 | `expected` | Mọi dòng | Chỉ điền ở step `check_status`/`check_value` |
| 17 | `[o]_observed` | — | Engine tự ghi (output) |
| 18 | `[o]_test_result` | — | Engine tự ghi (output) |
| 19 | `[o]_screenshot` | — | Engine tự ghi (output) |
| 20 | `[o]_duration_(s)` | — | Engine tự ghi (output) |
| 21 | `note` | Tùy chọn | Ghi chú riêng cho step/TC |

> **"Đầu TC"** = Chỉ ghi ở dòng đầu tiên (dòng chứa `ll_tc_id`). Các dòng step tiếp theo để trống cột 1–11. **CẤM merge cell.**

**`[L3-05]`** Cột `added_manually`: Chỉ điền `Y`/`N` ở dòng đầu TC. Các dòng step sau để trống.

**`[L3-06]`** Cột `precondition`: Giá trị phải khớp với `tc_id` trong sheet PRECONDITION (global hoặc cục bộ). Có thể kết hợp nhiều precondition bằng dấu phẩy: `pre_login, pre_select_room`.

---

## 🏷️ PHẦN 5: QUY CHUẨN ĐẶT TÊN ELEMENT ID (ELEM)

**`[ELEM-01]`** Mọi `element_id` viết **snake_case** + bắt buộc prefix:

| Prefix | Loại | Ví dụ |
|:---|:---|:---|
| `txt_` | Input text, textarea, password | `txt_weight`, `txt_search_keyword` |
| `ddl_` hoặc `select_` | Dropdown / Combobox | `ddl_hospital`, `select_vaccine_type` |
| `btn_` | Button | `btn_login`, `btn_save_screening` |
| `chk_` | Checkbox | `chk_agree_terms` |
| `rad_` | Radio button | `rad_gender_male` |
| `lbl_` | Label / text hiển thị | `lbl_total_records` |
| `lnk_` | Hyperlink | `lnk_forgot_password` |
| `error_` | Thông báo lỗi validation | `error_weight_range` |
| `toast` | Toast notification | `toast_success` |
| `tbl_` | Table | `tbl_patient_list` |
| `dlg_` / `modal_` | Dialog / Popup / Modal | `modal_confirm_delete` |
| `icon_` | Icon | `icon_close_modal` |
| `tab_` | Tab | `tab_personal_info` |

---

## 🚫 PHẦN 6: QUY TẮC GIÁ TRỊ DỮ LIỆU (DATA)

**`[DATA-01]`** **CẤM ô trống** trong sheet DATA:
- Không áp dụng → điền `n/a`
- Giả lập chuỗi rỗng → điền `empty`

**`[DATA-02]`** Cú pháp tham chiếu:

| Cú pháp | Dùng khi | Ví dụ |
|:---|:---|:---|
| `$data_{MODULE}.{col}` | Tham chiếu DATA sheet | `$data_Danh_Gia_Ban_Dau.weight` |
| `$data_login_{role}.username` | Tham chiếu login | `$data_login_doctor.username` |
| `${env:VAR}` | Biến môi trường | `${env:USER_DOCTOR}` |
| `$env_data.{element_id}[RANDOM]` | Dropdown theo môi trường | `$env_data.ddl_room_select[RANDOM]` |
| `$env_data.{element_id}[INDEX:n]` | Dropdown chỉ định vị trí | `$env_data.ddl_customer[INDEX:1]` |

**`[DATA-03]`** Từ khóa cú pháp viết đúng hoa/thường: `n/a`, `empty`, `ON`, `OFF`, `Y`, `N`, `RANDOM`, `INDEX:n`.

---

## 🔗 PHẦN 7: MATCHING RULES — Cách Engine khớp DATA với TEST_CASE

> **Đây là phần AI Agent cần hiểu rõ** để sinh đúng format `test_case_type` và `type`.

**`[MATCH-01]`** Engine khớp dữ liệu DATA với TEST_CASE theo logic sau (theo thứ tự ưu tiên):

```
1. Exact Match (ưu tiên cao nhất):
   DATA.test_case_type === TEST_CASE.ll_tc_id (viết HOA)
   VD: test_case_type = "LL_001" → match TC có ll_tc_id = "LL_001"

2. Type Match:
   DATA.test_case_type === TEST_CASE.type (viết thường)
   VD: test_case_type = "pos" → match mọi TC có type = "pos"

3. Regex Match (dạng {prefix}_tc_{num}):
   DATA.test_case_type = "neg_tc_004" → match TC có type = "neg" VÀ ll_tc_id kết thúc bằng "_004"
```

**`[MATCH-02]`** Khi nhiều dòng DATA cùng match 1 TC → Engine chạy iterations (iter-1, iter-2...).

**`[MATCH-03]`** TC có `parameterized = Y` BẮT BUỘC phải:
- Có cột `type` không trống
- Có ít nhất 1 dòng DATA match
- Có ít nhất 1 step dùng `$data_` trong cột `value`

**`[MATCH-04]`** TC có `parameterized = N` BẮT BUỘC:
- Không dùng `$data_` trong cột `value` (hoặc chỉ dùng giá trị tĩnh)

---

## 🤖 PHẦN 8: VALIDATION CHECKLIST — AI tự kiểm trước khi ghi file

**`[AI-01]`** Trước khi ghi Excel, AI bắt buộc kiểm tra:

### Sheet ELEMENT
- [ ] Mọi `element_id` đúng prefix (Phần 5) và unique trong sheet
- [ ] `locator_type` thuộc danh sách hợp lệ (Phần 4)
- [ ] `locator_value` không rỗng

### Sheet DATA
- [ ] Không có ô trống (dùng `n/a` hoặc `empty`)
- [ ] Cột đầu tiên tên `test_case_type`
- [ ] Giá trị `test_case_type` khớp format Matching Rules (Phần 7)
- [ ] Không hardcode giá trị mô tả chung ("giá trị hợp lệ")

### Sheet TEST_CASE
- [ ] Đủ 21 cột đúng thứ tự (Phần 4, [L3-04])
- [ ] `action` thuộc danh sách keyword hợp lệ (Phần 9)
- [ ] `target` tồn tại trong ELEMENT hoặc là `page_key` hợp lệ
- [ ] Step `check_status`/`check_value` có cột `expected` không trống
- [ ] TC có `parameterized = Y` → có step dùng `$data_` trong `value`
- [ ] TC có `parameterized = N` → không dùng `$data_` trong `value`
- [ ] `is_run` chỉ dùng `ON` hoặc `OFF`
- [ ] `added_manually` chỉ dùng `Y` hoặc `N`, chỉ điền ở dòng đầu TC
- [ ] Cột `[o]_*` (4 cột output) có tiền tố `[o]_`

### Traceability
- [ ] Mọi `ml_tc_id` trong L2 → ít nhất 1 `ll_tc_id` tương ứng trong L3 (phủ 100%)

---

## ⚡ PHẦN 9: KEYWORD ACTIONS HỢP LỆ

Danh sách keyword đăng ký trong [actions.txt](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/config/actions.txt):

| Keyword | Mô tả ngắn |
|:---|:---|
| `navigate` | Điều hướng đến URL (target = page_key) |
| `click` | Click vào element |
| `dblclick` | Double click |
| `input` | Nhập dữ liệu (fill) |
| `clear` | Xóa dữ liệu input |
| `select` | Chọn dropdown option |
| `check_status` | Kiểm tra trạng thái: `visible`, `hidden`, `enabled`, `disabled` |
| `check_value` | Kiểm tra giá trị text/content |
| `wait_for` | Chờ trạng thái (target = element/page, value = `visible`/`hidden`/`networkidle`) |
| `upload_file` | Upload file |
| `scroll_to` | Cuộn đến element |
| `hover` | Rê chuột lên element |
| `press_key` | Nhấn phím (value = `Enter`, `Tab`, `Escape`) |
| `capture` | Chụp ảnh màn hình |
| `assert_url` | Kiểm tra URL hiện tại |

---

## 📌 PHẦN 10: VÍ DỤ HOÀN CHỈNH — Mini L3 Master (3 sheet)

### Sheet `ELEMENT_DEMO`

| element_id | locator_type | locator_value |
|:---|:---|:---|
| `txt_weight` | `data-testid` | `weight-input` |
| `txt_height` | `data-testid` | `height-input` |
| `btn_save` | `data-testid` | `btn-save-screening` |
| `toast_success` | `css` | `.ant-message-success` |
| `error_weight` | `css` | `[data-testid="weight-error"]` |

### Sheet `DATA_DEMO`

| test_case_type | weight | height | notes |
|:---|:---|:---|:---|
| `pos_001` | `70` | `170` | Happy path - giá trị giữa vùng |
| `pos_001` | `55.5` | `155` | Happy path - iteration 2 |
| `boundary_002` | `1.0` | `30.0` | BVA: min hợp lệ |
| `boundary_002` | `300.0` | `250.0` | BVA: max hợp lệ |
| `boundary_002` | `0.9` | `29.9` | BVA: dưới min (invalid) |
| `boundary_002` | `300.1` | `250.1` | BVA: trên max (invalid) |
| `neg_003` | `empty` | `170` | Negative: weight bỏ trống |
| `neg_004` | `70` | `empty` | Negative: height bỏ trống |

### Sheet `TEST_CASE_DEMO`

| FR | YC | hl_tc_id | ml_tc_id | ll_tc_id | is_run | added_manually | summary | type | parameterized | precondition | step | action | target | value | expected | [o]_observed | [o]_test_result | [o]_screenshot | [o]_duration_(s) | note |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| FR-9.1.2 | YC-001 | HL_001 | ML_9.1.2_001 | LL_001 | ON | N | Nhập sinh hiệu thành công | pos_001 | Y | pre_super_admin_login_success | 1 | navigate | danh_gia_ban_dau | | | | | | | |
| | | | | | | | | | | | 2 | click | lnk_first_row | | | | | | | |
| | | | | | | | | | | | 3 | input | txt_weight | $data_DEMO.weight | | | | | | | |
| | | | | | | | | | | | 4 | input | txt_height | $data_DEMO.height | | | | | | | |
| | | | | | | | | | | | 5 | click | btn_save | | | | | | | | |
| | | | | | | | | | | | 6 | check_status | toast_success | | visible | | | | | | |
| FR-9.1.2 | YC-001 | HL_001 | ML_9.1.2_002 | LL_002 | ON | N | Validate lỗi weight bỏ trống | neg_003 | Y | pre_super_admin_login_success | 1 | navigate | danh_gia_ban_dau | | | | | | | |
| | | | | | | | | | | | 2 | click | lnk_first_row | | | | | | | | |
| | | | | | | | | | | | 3 | input | txt_weight | $data_DEMO.weight | | | | | | | |
| | | | | | | | | | | | 4 | click | btn_save | | | | | | | | |
| | | | | | | | | | | | 5 | check_value | error_weight | | Cân nặng không được để trống | | | | | | |
