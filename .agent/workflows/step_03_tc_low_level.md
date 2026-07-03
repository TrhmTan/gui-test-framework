---
description: Sinh file Excel TC Low Level (L3 Master) từ L2 Test Plan — điền đầy đủ 3 sheet (ELEMENT, DATA, TEST_CASE) theo chuẩn dự án.
skills:
  - smart_locator_agent
  - generate_test_data
  - generate_combinatorial_test_data
  - flaky_test_analyzer
---

> **BẮT BUỘC (MANDATORY SKILLS):**
> 1. Đọc kỹ [test_design_rules.md](../rules/test_design_rules.md) (5 kỹ thuật thiết kế), [automation_rules.md](../rules/automation_rules.md) (quy tắc chung), [playwright_rules.md](../rules/playwright_rules.md) (quy tắc Playwright) và [excel_conventions.md](../rules/excel_conventions.md) (chuẩn format) trước khi bắt đầu.
> 2. Nạp và đọc kỹ nội dung các kỹ năng hỗ trợ:
>    * [skill_smart_locator_agent.md](../skills/skill_smart_locator_agent.md) để biết cách sinh locator tối ưu.
>    * [skill_generate_test_data.md](../skills/skill_generate_test_data.md) để phân tích trường nhập liệu và sinh test data BVA/Negative.
>    * [skill_generate_combinatorial_test_data.md](../skills/skill_generate_combinatorial_test_data.md) để sinh dữ liệu tổ hợp phức tạp.
>    * [skill_flaky_test_analyzer.md](../skills/skill_flaky_test_analyzer.md) để phân tích và khắc phục flaky tests.

# Workflow: Sinh Test Case Low-Level (L3 Master) từ Mid-Level

Workflow này hướng dẫn AI Agent chuyển hóa file L2 Test Plan thành bộ test suite tự động hóa hoàn chỉnh bậc thấp (L3 Master Excel) gồm 3 sheet: `ELEMENT_{MODULE}`, `DATA_{MODULE}`, và `TEST_CASE_{MODULE}`.

## ⚠️ Nguyên tắc thực thi

- **RULE-01 (Tích hợp mô-đun hóa và chuyển đổi Workflow thành Skill):** Gắn kết chặt chẽ các năng lực tạo dữ liệu, phân tích flaky test vào thư mục `skills/` để Agent có thể dễ dàng nạp thông qua phần khai báo `skills` ở file workflows và áp dụng chuẩn xác cho nhiều bộ kịch bản test L3.
- **RULE-02 (Auto-waiting và hạn chế wait_for):** Loại bỏ việc lạm dụng chèn `wait_for` trước mọi hành động UI, tận dụng tối đa cơ chế auto-waiting ngầm của Playwright và chỉ dùng `wait_for` cho các trường hợp tải bất đồng bộ thực sự (như loading spinner biến mất, chuyển trang chậm, toast xuất hiện).
- **RULE-03 (Quy trình Checkpoint nghiêm ngặt):** Đảm bảo Agent luôn dừng lại để xin ý kiến phản hồi tại các mốc quan trọng (Kế hoạch test ở Bước 2, Báo cáo kiểm định tự động ở Bước 6).
- **RULE-04 (Ràng buộc phạm vi URL - URL Scope Lock & Emergency Stop) [CRITICAL]:** Khi tương tác hoặc quét DOM trên trình duyệt, Agent và browser subagent bắt buộc chỉ được hoạt động trên đúng URL mục tiêu đã cấu hình.
  * **CẤM TUYỆT ĐỐI** click vào Sidebar, Top Navigation Bar, Header hoặc bất kỳ menu/liên kết điều hướng nào ngoài màn hình mục tiêu làm thay đổi URL.
  * **CẤM TUYỆT ĐỐI** tự ý nhấn nút Lưu, Gửi, Ký số hoặc Xác nhận (Submit) các form làm thay đổi dữ liệu thật hoặc kích hoạt chuyển trạng thái trên hệ thống, trừ khi được yêu cầu rõ ràng.
  * **CƠ CHẾ DỪNG KHẨN CẤP (Emergency Stop):** Nếu trình duyệt bị chuyển hướng lệch khỏi URL mục tiêu (như sang trang `/cashier`, `/doctor`...), subagent **bắt buộc phải dừng (STOP) thực thi lập tức**, crash/throw error để trả quyền kiểm soát lại cho người dùng và báo cáo lỗi cho Agent chính. Không được phép tự ý thực hiện tiếp các bước của luồng khác. Đặc biệt, khi gọi browser subagent, Agent chính bắt buộc phải truyền quy tắc này vào prompt Task của subagent để khóa phạm vi hoạt động của nó.
- **RULE-05 (Traceability Mapping Lock - Phủ 100% L2):** Đảm bảo phủ 100% `ml_tc_id` từ L2 sang L3 theo mô hình phân rã 1-N. Mỗi `ml_tc_id` từ L2 phải có ít nhất một hoặc nhiều test cases `ll_tc_id` tương ứng kiểm thử các dải dữ liệu. Cấm tự ý lược bỏ kịch bản L2.
- **RULE-06 (Step Alignment & Action Mapping):** Các bước kịch bản kỹ thuật L3 phải bám sát và cụ thể hóa luồng nghiệp vụ của `ml_tc_id` tương ứng trong L2, bao gồm đầy đủ các bước điều hướng và chuẩn bị dữ liệu (như click chọn khách hàng, chọn phòng khám, click nút mở form) thay vì tự chế tác.

## Các bước thực hiện

### Bước 1: Phân tích L2 Test Plan
1. Đọc file kịch bản L2 tại `data/{MODULE}/L2_Mid_Level/ML_TC_{CATALOG_NO}_{SCREEN}.xlsx`.
2. Trích xuất toàn bộ danh sách `ml_tc_id` có trong sheet `test_case_{screen}`.
3. Phân tích sheet `rule_{screen}` để nắm rõ các validation rules (bắt buộc, min, max, kiểu dữ liệu) của từng trường.
4. Đọc kịch bản manual sơ bộ tại sheet `test_case_{screen}` để hiểu luồng đi của từng test case.

### Bước 2: CHECKPOINT — Trình Bày Kế Hoạch Test ⏸️
Trình bày bảng kế hoạch phân rã test cases cho người dùng duyệt dưới dạng sau:
```text
📋 KẾ HOẠCH PHÂN RÃ TEST L3 — {MODULE}
═══════════════════════════════════
Tổng số kịch bản trong L2: ? TCs
Danh sách các ML_TC_ID sẽ được phủ: [ML_9.1.2_001, ML_9.1.2_002, ...]

Phân rã kịch bản L3 dự kiến:
  - {ML_TC_ID_1}: Sinh N1 TCs (Positive: ?, Negative: ?, Boundary: ?)
  - {ML_TC_ID_2}: Sinh N2 TCs ...
Tổng số Low-Level Test Cases (L3) dự kiến sinh ra: ? TCs
═══════════════════════════════════
```
**Dừng lại chờ người dùng xác nhận** trước khi chuyển sang Bước 3.

### Bước 3: Khảo sát DOM & Sinh Sheet `ELEMENT_{SCREEN}` (Giai đoạn 1 - Tự động hóa đăng nhập và dump HTML/DOM)
1. **Viết script Playwright độc lập** (ví dụ: `tmp/dump_elements.ts`) để thực hiện tự động hóa:
   * Nạp thông tin đăng nhập và bệnh viện từ [credentials.env](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/config/credentials.env).
   * Khởi chạy trình duyệt (headless mode), tự động đăng nhập Keycloak qua Keycloak button (nếu có) hoặc điền form `#username` / `#password`.
   * Chọn bệnh viện / chi nhánh phù hợp từ trang chọn bệnh viện (nếu xuất hiện).
   * Điều hướng trực tiếp tới URL đích của module/màn hình cần quét.
   * Thực hiện tương tác (ví dụ: click nút tiếp đón) để mở các popup, modal cần kiểm tra.
2. **Dump HTML & Elements ra file tĩnh:**
   * Sử dụng Playwright API lấy `outerHTML` của phần tử modal/popup hoặc container chính.
   * Ghi toàn bộ HTML tĩnh thu được ra file tạm (ví dụ: `tmp/popup_checkin.html`) và xuất danh sách các node con có thuộc tính test ra file JSON (ví dụ: `tmp/popup_elements.json`).
3. **Trích xuất locator chuẩn theo thứ tự ưu tiên:**
   * Phân tích file HTML/JSON tĩnh thu được.
   * Định nghĩa locator cho từng element tuân thủ nghiêm ngặt **Bản Đồ Ưu Tiên** tại [locator_strategy.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/locator_strategy.md) (Số 1 là `data-testid`, **HẠN CHẾ TỐI ĐA** dùng `xpath` trừ khi 7 phương pháp trên hoàn toàn không có).
   * **ĐẶC BIỆT (Quy tắc Label):** Nếu `element_id` có prefix `lbl_` (nhãn hiển thị), mặc định sử dụng `locator_type` = `text` và `locator_value` = nội dung text hiển thị của nhãn đó (bao gồm ký tự đặc biệt như `*` nếu có). Nếu nhãn bị trùng lặp với trang background, sử dụng kết hợp CSS scope với text (ví dụ: `css` | `[role="dialog"] >> label >> text="Khách hàng"`) để định vị duy nhất.
4. **Cập nhật Excel bằng code:**
   * Viết script Node sử dụng thư viện `exceljs` (ví dụ: `tmp/update_elements_excel.ts`) để tự động cập nhật hoặc thêm mới các dòng locator vào sheet `ELEMENT_{SCREEN}` thay vì sửa Excel thủ công (nhanh hơn, chính xác hơn và giữ nguyên style format Excel).


### Bước 4: Thiết kế Dữ liệu Kiểm thử → Sheet `DATA_{SCREEN}`
1. Dựa trên các kịch bản test đã lên kế hoạch ở Bước 2, tiến hành sinh test data cụ thể:
2. **BẮT BUỘC TÍCH HỢP:**
   * Đối với form nhập liệu đơn thông thường: Gọi quy trình `skill_generate_test_data.md` để phân tích và sinh data biên BVA, validation.
   * Đối với nghiệp vụ liên kết chuỗi, ma trận kết hợp phức tạp: Gọi quy trình `skill_generate_combinatorial_test_data.md` để giải quyết ma trận tổ hợp.
3. Đảm bảo dữ liệu sinh ra đầy đủ 4 nhóm: Positive (happy path), Boundary (BVA - tối thiểu 4 dòng cho trường số), Negative (One-wise - chỉ 1 trường sai), Edge case.
   * **BẮT BUỘC VỀ BVA (Quy tắc BVA-04)**: Không sử dụng các dấu so sánh nghiêm ngặt `<` hoặc `>` khi mô tả dải giá trị hoặc sinh dữ liệu. Các giá trị kiểm thử ngoài biên phải được xác định rõ ràng thông qua dấu `<=`, `>=` dựa trên kiểu dữ liệu và sai số (ví dụ: `pulse <= 29` hoặc `pulse >= 201`).
4. Đóng gói dữ liệu với cột đầu tiên là `test_case_type` (hoặc `type_test_case`) và không để trống bất kỳ ô nào (dùng `n/a` hoặc `empty`). **CẤM** đặt tên `test_case_type` chung chung; bắt buộc ghi trùng khớp với cột `type` ở sheet `TEST_CASE` (ví dụ: `neg_004`, `pos_001`) để Engine nhận diện chạy vòng lặp tham số hóa (iter-1, iter-2...). Khi có nhiều bộ dữ liệu trùng mã ngắn này trong sheet DATA, Engine sẽ tự động lặp qua từng bộ data. Sử dụng tham chiếu động `$env_data.element_id[INDEX:x]` cho các dropdown trong file config JSON.

### Bước 5: Sinh kịch bản chi tiết → Sheet `TEST_CASE_{SCREEN}`
1. Lần lượt phân rã từng `ml_tc_id` từ L2 thành các test case chi tiết ở L3.
2. Với mỗi test case L3 sinh ra, điền chính xác `ml_tc_id` tương ứng ở cột `ml_tc_id` và gán mã `ll_tc_id` mới (ví dụ: `LL_9.1.2_001a`, `LL_9.1.2_001b`...).
3. Ánh xạ chi tiết các bước nghiệp vụ ở cột `steps` của L2 thành các action keyword Playwright tương ứng, đảm bảo đầy đủ các bước tương tác trung gian (click chọn dòng khách hàng, click chọn phòng khám, chờ modal load...) và check status kết quả.
4. Chuyển đổi các bước test manual sang các action keywords hợp lệ (đăng ký tại `config/actions.txt`).
5. Định dạng các cột test case:
   `FR | YC | hl_tc_id | ml_tc_id | ll_tc_id | is_run | added_manually | summary | type | parameterized | precondition | step | action | target | value | expected`
   * **Cột `type`**: Ghi giá trị phân loại mã ngắn (ví dụ: `neg_004`, `pos_001`) trùng khớp 1-1 với cột `test_case_type` (hoặc `type_test_case`) của sheet `DATA` để kích hoạt chế độ parameterized và chạy các vòng lặp (iterations: iter-1, iter-2, ...).
6. Gán giá trị `'N'` ở cột `added_manually` cho các test case được tạo tự động bởi AI.
7. Tham chiếu dữ liệu bằng cú pháp `$data_{SCREEN}.{column}` cho cột `value`.
8. Đảm bảo không sử dụng `wait_for` dư thừa.

### Giai đoạn 2: Kích hoạt element động và quét bổ sung
* Đối với các element động ẩn (như dropdown list options, tooltip, toast thông báo lỗi validation):
  * Cấu hình trong script Playwright tương tác trigger chúng xuất hiện (ví dụ: click vào dropdown để hiển thị list options).
  * Tiếp tục dump HTML của phần tử động đó và trích xuất locator theo Chiến Lược Locator, rồi dùng code update append vào sheet ELEMENT.


### Bước 6: Tự động Kiểm Định và Đóng Gói (Validation) ⏸️
1. **BẮT BUỘC TÍCH HỢP:** Sau khi hoàn thiện bản thảo Excel L3 Master, Agent phải chạy trực tiếp quy trình [validate_excel.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/workflows/validate_excel.md) để tự kiểm tra lỗi (prefix, trùng lặp ID, ô trống, action hợp lệ).
2. Trình bày báo cáo validation chi tiết trên chat và chờ phản hồi của người dùng:
   * Nếu có lỗi `ERROR`: Sửa lỗi ngay lập tức và validate lại.
   * Nếu không có lỗi `ERROR` (hoặc chỉ có `WARN` được chấp nhận): Xin ý kiến người dùng `ok` để lưu chính thức file Excel L3 Master tại:
     `data/{MODULE}/L3_Low_Level/{CATALOG_NO}_{folder}/Master_Test_Suite_{CATALOG_NO}_{SCREEN}.xlsx`.

### Bước 7: Chạy Thử và Khắc Phục Flaky (Stability Verification)
1. Thực thi chạy test suite trên terminal: `.\run {catalog_no} test` (hoặc `npm run test -- --grep "{CATALOG_NO}"`).
2. Quan sát log console và kết quả ghi nhận.
3. **BẮT BUỘC TÍCH HỢP:** Nếu xuất hiện test case bị thất bại hoặc chạy không ổn định (flaky):
   * Kích hoạt quy trình `skill_flaky_test_analyzer.md` để phân tích nguyên nhân gốc rễ.
   * Tự động cập nhật sửa lỗi kịch bản trên file Excel (Mode FIX).
   * Chạy verify lại tối thiểu 3 lần liên tiếp cho đến khi pass ổn định.

## Output yêu cầu

* File Excel L3 Master hoàn chỉnh, sạch lỗi format, được lưu tại thư mục đích.
* Báo cáo Validation Excel (trước khi ghi file).
* Báo cáo chạy test thực tế và kết quả khắc phục flaky test (nếu có).
