# GEMINI AI - GLOBAL AUTOMATION AGENT RULES (UNIFIED-GUI-TESTING-TOOL)

> **Phạm vi áp dụng:** Áp dụng cho tất cả các tác vụ kiểm thử tự động (Automation Testing) do AI Agent (Gemini/Antigravity) thực hiện trong dự án **unified-gui-testing-tool** (framework `unified-gui-testing-tool`).
> **Mục tiêu:** Định hướng cho AI Agent sinh test cases/test data chuẩn, viết mã nguồn hiệu quả, tự động hóa dọn dẹp workspace và tối ưu hóa quota token tối đa.

---

## 1. Nguyên Tắc An Toàn & Git (Security & Git Restrictions)

### 🚨 An toàn dữ liệu (CRITICAL)
* **CẤM** tự ý thực thi các lệnh phá hủy hệ thống hoặc cơ sở dữ liệu (ví dụ: `DROP TABLE`, `DELETE`, `rm -rf`, `Remove-Item -Recurse -Force`) mà không có sự đồng ý rõ ràng và bằng văn bản từ USER.
* **CẤM** in/hiển thị các thông tin nhạy cảm như API Keys, Mật khẩu (Passwords), Tokens, Chuỗi kết nối (Connection Strings) ra màn hình chat.
* **CẤM** commit hoặc push các file chứa thông tin đăng nhập/credentials thật lên repository. Mọi tài khoản test phải dùng biến môi trường cấu hình tại [credentials.env](file:///c:/Users/your-username/Documents/Antigravity/unified-gui-testing-tool/config/credentials.env) (file này phải nằm trong danh sách `.gitignore`).
* Luôn kiểm tra kỹ các câu lệnh trước khi thực thi nếu chúng có khả năng thay đổi hoặc xóa dữ liệu.

### 🚫 Giới hạn câu lệnh Git (Git Pull/Push Restrictions)
* **Tuyệt đối KHÔNG** sử dụng các câu lệnh Git làm thay đổi trạng thái code trên máy local (như `git pull`, `git checkout`, `git merge`, `git rebase`, `git reset`). Việc pull/checkout tự ý có thể ghi đè và làm hỏng mã nguồn đang chỉnh sửa.
* Luôn giữ nguyên trạng thái code local hiện tại để làm việc. Nếu cần file hoặc nội dung mới, hãy yêu cầu người dùng cung cấp trực tiếp.
* **ĐƯỢC PHÉP** sử dụng các câu lệnh read-only để kiểm tra trạng thái: `git status`, `git diff`, `git log`.

---

## 2. Quy Tắc Trình Duyệt & Debug UI (Browser & Playwright Rules)

### 🖥️ Cấu hình Viewport & Chế độ chạy
* Tất cả các tác vụ **UI debugging** bắt buộc phải chạy với kích thước màn hình desktop chuẩn: **`1920x1080`**.
* Bắt buộc mở trình duyệt thật (Headed mode) trong quá trình debug lỗi UI để quan sát trực quan.
* Chỉ sử dụng chế độ chạy ẩn (Headless mode) **sau khi** test suite đã chạy PASS ổn định trên UI, hoặc chạy mặc định trên môi trường CI/CD.

### 🔄 Quy trình Debug Playwright bắt buộc
Khi sử dụng công cụ Playwright (hoặc Playwright MCP) để tương tác hoặc debug UI, AI Agent **LUÔN LUÔN** tuân thủ đúng thứ tự các bước:
```
navigate (điều hướng) → resize (1920×1080) → wait_for (đợi page load) → snapshot (quét DOM) → interact (tương tác) → screenshot (chụp ảnh nếu lỗi)
```
* **KHÔNG** gọi lại lệnh điều hướng (`navigate`) nếu trang hiện tại đã đúng địa chỉ — tránh reload trang không cần thiết.
* **LUÔN** gọi lệnh resize kích thước màn hình về `1920x1080` ngay sau khi điều hướng thành công.
* **LUÔN** kiểm tra và xác nhận trang web đã tải xong hoàn toàn trước khi chụp snapshot DOM hoặc thực hiện tương tác click/input.
* Sử dụng công cụ **`snapshot`** để phân tích DOM thực tế nhằm xác định locator chuẩn xác — **CẤM đoán mò locator**.
* Sử dụng công cụ **`screenshot`** để ghi lại bằng chứng khi assertions bị thất bại hoặc tại các mốc kiểm thử quan trọng. Không chụp ảnh tràn lan gây lãng phí tài nguyên.

---

## 3. Kiến Trúc Framework & Quy Chuẩn File Excel (Config-Driven Framework)

AI Agent phải nắm rõ kiến trúc Config-Driven của hệ thống: **"Code không đổi khi đổi dự án"**. Mọi thay đổi về dự án hoặc module chỉ thực hiện qua file cấu hình và Excel, không sửa code trong thư mục `src/`.

### 📂 Cấu trúc thư mục cốt lõi
* **`.agent/`**: Nơi lưu trữ tri thức của AI Agent.
  * [rules/test_design_rules.md](file:///c:/Users/your-username/Documents/Antigravity/unified-gui-testing-tool/.agent/rules/test_design_rules.md): Quy tắc thiết kế test case bắt buộc.
  * [rules/EXCEL_CONVENTIONS.md](file:///c:/Users/your-username/Documents/Antigravity/unified-gui-testing-tool/.agent/rules/EXCEL_CONVENTIONS.md): Quy chuẩn file Excel.
* **`config/`**: Chứa file cấu hình hệ thống:
  * `project.yaml`: File cấu hình dự án duy nhất (base_url, modules, v.v.).
  * `credentials.env`: Lưu thông tin tài khoản đăng nhập (đã gitignore).
  * `actions.txt`: Danh sách 15+ keyword actions đã đăng ký (navigate, click, input, v.v.).
  * `global/preconditions.xlsx`: Khai báo PAGE, DATA_LOGIN, và PRECONDITION dùng chung.
* **`data/`**: Chứa dữ liệu Excel 3 tầng được phân cấp theo dự án/module:
  * `data/templates/`: Các file Excel mẫu L1, L2, L3.
  * `data/{Project_Name}/L1_High_Level/`: File checklist yêu cầu nghiệp vụ.
  * `data/{Project_Name}/L2_Mid_Level/`: File kịch bản/test plan.
  * `data/{Project_Name}/L3_Low_Level/`: File Master chứa chi tiết các bước chạy (Ví dụ: `Master_Test_Suite_9.2.1_Ds_Cho_Tiem.xlsx`).
* **`src/`**: Mã nguồn TypeScript của Engine chạy test (ConfigLoader, ExcelReader, ActionExecutor, DataResolver, v.v.). **Tuyệt đối không tự ý sửa đổi trừ khi mở rộng keyword actions**.

### 📊 Quy chuẩn Master Excel L3 (Sheet Element & Data)
* **Naming Convention bắt buộc trong sheet `ELEMENT_{MODULE}`**:
  * `txt_`: Ô nhập liệu text, textarea (ví dụ: `txt_username`).
  * `ddl_` hoặc `select_`: Hộp chọn dropdown (ví dụ: `ddl_hospital`).
  * `btn_`: Nút bấm (ví dụ: `btn_login`).
  * `chk_`: Ô đánh dấu checkbox (ví dụ: `chk_agree_terms`).
  * `rad_`: Nút chọn một (ví dụ: `rad_gender_male`).
  * `lbl_`: Nhãn hoặc văn bản hiển thị (ví dụ: `lbl_error_message`). **Định vị:** Mặc định sử dụng `locator_type` = `text` và `locator_value` = nội dung text hiển thị của nhãn đó (bao gồm cả các ký tự đặc biệt như `*` nếu có). Trong trường hợp nhãn bị trùng lặp trên trang (ví dụ ở trang background phía sau popup), sử dụng kết hợp CSS scope với text (ví dụ: `css` | `[role="dialog"] >> label >> text="Khách hàng"`) để đảm bảo định vị duy nhất.
  * `lnk_`: Đường dẫn liên kết (ví dụ: `lnk_forgot_password`).
  * `error_`: Vùng hiển thị thông báo lỗi validation.
  * `toast`: Toast thông báo góc màn hình.
* **Quy chuẩn dữ liệu trong sheet `DATA_{MODULE}`**:
  * **CẤM để ô trống trong sheet DATA**.
  * Sử dụng giá trị `n/a` nếu cột đó không áp dụng cho test case hiện tại.
  * Sử dụng giá trị `empty` nếu muốn giả lập truyền chuỗi rỗng (`""`).
* **Quy chuẩn kịch bản trong sheet `TEST_CASE_{MODULE}`**:
  * **BẮT BUỘC có cột `added_manually`**: Cột này nằm sau cột `is_run` và trước cột `summary`.
  * **Cờ đánh dấu**: Điền `'N'` cho các test case được sinh tự động bởi tool/AI và `'Y'` cho các test case do con người (QA/QC) bổ sung bằng tay.
  * **Vị trí điền**: Chỉ điền `'N'` hoặc `'Y'` ở dòng khai báo test case đầu tiên (dòng chứa ID `ll_tc_id`). Các dòng steps tiếp theo thuộc cùng test case để trống cột này.

---

## 4. Quy Tắc Thiết Kế Test Case & Sinh Dữ Liệu (Test Design Rules)

Khi tạo mới hoặc cập nhật các test cases, AI Agent **bắt buộc** phải tuân thủ hướng dẫn chuẩn ISTQB tại [test_design_rules.md](file:///c:/Users/your-username/Documents/Antigravity/unified-gui-testing-tool/.agent/rules/test_design_rules.md).

### 📐 5 Kỹ thuật thiết kế bắt buộc theo thứ tự ưu tiên:
1. **Phân vùng tương đương (Equivalence Partitioning - EP)**: Phân chia rõ ràng vùng hợp lệ (Valid) và không hợp lệ (Invalid). Mỗi vùng phải có giá trị kiểm thử cụ thể (cấm ghi chung chung "Nhập giá trị hợp lệ").
2. **Phân tích giá trị biên (Boundary Value Analysis - BVA)**: Áp dụng quy tắc kiểm thử 6 điểm biên (`min - ε`, `min`, `min + ε`, `max - ε`, `max`, `max + ε`). Mỗi biên là một dòng dữ liệu riêng biệt, không gộp chung.
3. **Bảng quyết định (Decision Table - DT)**: Áp dụng khi logic nghiệp vụ có từ 2 điều kiện đầu vào kết hợp trở lên. Mỗi quy tắc (Rule) là một test case riêng biệt.
4. **Kiểm thử đơn biến (One-wise Testing)**: Áp dụng khi sinh các test case Negative cho Form Validation. Chỉ để 1 trường dữ liệu sai (Invalid), tất cả các trường còn lại giữ ở trạng thái hợp lệ baseline.
5. **Kiểm thử cặp (Pair-wise Testing)**: Áp dụng khi form nhập liệu phức tạp có từ 4 tham số trở lên nhằm giảm số lượng test case nhưng vẫn đảm bảo độ phủ tối đa.

### 📋 Checklist Tự Kiểm Tra (Review Checklist)
Trước khi bàn giao kết quả tạo test case, AI Agent **bắt buộc** phải tự đánh giá lại theo checklist trong phần [Checklist Tự Kiểm Tra](file:///c:/Users/your-username/Documents/Antigravity/unified-gui-testing-tool/.agent/rules/test_design_rules.md#6-checklist-tu-kiem-tra-review-checklist---bat-buoc) để đảm bảo không sót điều kiện logic, kiểu dữ liệu đặc biệt (Unicode, khoảng trắng, chữ hoa/thường) hay định dạng Excel.

---

## 5. Quy Trình Làm Việc & Các Slash Commands

AI Agent hoạt động chủ yếu thông qua việc nhận lệnh trực tiếp hoặc kích hoạt các quy trình tự động hóa (Workflows) được cấu hình tại thư mục `.agent/workflows/`. Hãy giới thiệu hoặc khuyến khích USER chạy các lệnh này:

* `/init-project`: Khởi tạo cấu trúc thư mục dự án mới.
* `/l1-to-l2`: Thực hiện quét DOM (DOM Discovery) và tự sinh L2 Test Plan từ L1 Checklist.
* `/l2-to-l3`: Tự động chuyển đổi L2 Test Plan thành các bước L3 chi tiết và sinh Test Data biên.
* `/run-test`: Kích hoạt chạy test suite cho module hoặc dự án chỉ định.
* `/debug-tc`: Chạy debug và phân tích log sửa lỗi cho test case bị fail.
* `/update-element`: Quét lại UI và tự động cập nhật các định nghĩa locators mới.
* `/gen-report`: Tổng hợp kết quả thực thi và sinh báo cáo kết quả kiểm thử.
* `/validate-excel`: Kiểm tra lỗi định dạng, ô trống hoặc sai lệch thông tin trong các file Excel.

---

## 6. Tiêu Chi Bàn Giao & Quy Trình Dọn Dẹp Workspace (Definition of Done & Cleanup)

### 🧹 Cleanup Temp & Debug Files (Quy định bắt buộc cuối mỗi nhiệm vụ)
Để bảo vệ workspace sạch sẽ, tránh tràn ngập file rác và tiết kiệm token cho các lần đọc sau, AI Agent **bắt buộc** phải thực hiện quy trình dọn dẹp sau đây trước khi kết thúc phiên làm việc:

1. **Quét (Scan)** thư mục gốc của workspace và các thư mục con cấp 1 để tìm các file tạm, file debug.
2. **Xóa (Delete)** tất cả các file sau:
   - Các file có hậu tố debug: `*_debug.txt`, `debug_output.txt`, `*_output.txt`
   - Các file tạm: `*.tmp`, `*.temp`
   - Các file snapshot trang web: `page_snapshot.md`, `snapshot_*.md`
   - Các file dump mã nguồn DOM: `dom_dump.txt`, `html_dump.html`
   - Các file log tạm thời: `network_requests.txt`, `console_log.txt`
   - Các script nháp: `scratch_*.py`, `scratch_*.js`, `scratch_*.ts`
   - Các file mã nguồn `.py`, `.js`, `.ts` nằm lạc chỗ ở ngoài các thư mục quy định (`src/`, `tests/`, `scripts/`).
3. **Báo cáo (Report)** rõ ràng danh sách các file đã xóa ở phần tóm tắt cuối phiên làm việc.
4. **Lưu ý: KHÔNG ĐƯỢC XÓA** các thư mục hệ thống/cấu hình/báo cáo chính thức: `node_modules/`, `.git/`, `playwright-report/`, `test-results/`, `logs/` (thư mục log chủ ý của dự án), và thư mục chứa deliverables `artifacts/`.

### ✅ Tiêu chí hoàn thành (Definition of Done)
Một tác vụ viết code test/script chỉ được coi là hoàn thành khi:
- Code dọn sạch hoàn toàn các dòng `console.log()`, `print()` tạm thời.
- Không có các câu lệnh chờ cứng vô căn cứ (`waitForTimeout`, `Thread.sleep`).
- Test suite **PASS ổn định tối thiểu 2 lần liên tiếp** trên UI (headed mode).
- Dữ liệu test được sinh ngẫu nhiên/traceable theo đúng quy tắc thiết kế dữ liệu.

---

## 7. Cẩm Nang Tối Ưu Token Quota (Token Quota Tips)

Tương tác với AI Agent tiêu tốn token rất nhanh thông qua các lượt chat tích lũy context. Hãy áp dụng các mẹo sau để bảo vệ quota:

* **Chiến thuật "Chia để trị"**:
  * Dùng **Planning Mode** (Độ mạnh cao, đọc rộng) khi thiết lập cấu trúc nền tảng mới, xây dựng Base Test hoặc dựng khung POM cho module mới.
  * Tắt Planning Mode, chuyển về **Fast Mode** cho các tác vụ bảo trì hàng ngày (sửa locator, thêm assertions, cập nhật data, fix bug nhỏ).
* **Chọn đúng mô hình AI phù hợp**:
  * **Gemini Flash / Claude Haiku**: Cực kỳ tiết kiệm. Dùng để đọc log CI/CD dài, phân tích mã nguồn HTML thô để trích xuất locator, sinh mock data hàng loạt, và viết tài liệu hướng dẫn/docs.
  * **Gemini Pro**: Dùng để sửa code phổ thông, thay đổi locators, refactor các methods đơn giản.
  * **Claude Sonnet / Opus**: Chỉ dùng khi gặp bài toán thực sự hóc búa (lỗi flaky test khó tái hiện, Shadow DOM, iFrame lồng nhau phức tạp).
* **Tối ưu hóa câu hỏi gửi đi**:
  * Tránh copy toàn bộ thẻ `<body>` HTML. Hãy inspect và chỉ copy đoạn HTML nhỏ bao quanh khu vực chứa element cần tương tác.
  * Sử dụng tính năng `@mention` để chỉ định đích danh file Test/Page Object đang làm việc, tránh AI tự ý quét và đọc toàn bộ thư mục dự án.
  * Tách nhỏ các phiên làm việc (mở conversation mới) khi chuyển sang làm việc với một page/chức năng hoàn toàn độc lập khác.
