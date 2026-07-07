# 🚀 Unified GUI Testing Tool (Playwright & Excel-Driven Framework)

## 🇬🇧 English Overview (for clients / portfolio)

A **keyword-driven, Excel/config-driven UI automation framework** built on **Playwright + TypeScript**. Manual testers and domain experts write and maintain test cases directly in Excel — no code changes required — while the underlying engine stays clean and reusable across projects.

**Core capabilities:**
- **Keyword-driven engine** — steps are rows in Excel (`click`, `input`, `assert_url`, `check_status`, etc.), executed by a pluggable action-handler system in `src/core/actions/`. Adding a new keyword means adding one handler class, not touching test logic.
- **Two-file environment switching** — point the whole suite at a new project/target by editing only `config/project.yaml` (base URL per environment, domain label) and `config/credentials.env` (login accounts). No code changes.
- **Three-tier test design (L1/L2/L3)** — business checklist → test plan → executable low-level steps with locators and data, so non-technical stakeholders can review/approve at the L1/L2 level before anything runs.
- **Health-check fail-fast** — verifies the target environment is reachable before running, so a down server or missing VPN doesn't waste time on timeouts.
- **Visual regression testing** — a `check_visual` keyword (pixel-diff via Playwright's `toHaveScreenshot()`) usable from the same Excel sheet as every other step, with optional dynamic-region masking and per-step threshold tuning. No separate tool or script to run.
- **Accessibility (WCAG) testing** — a `check_a11y` keyword (axe-core under the hood) scans a page or a specific element for accessibility violations, with per-step rule/tag/severity filtering and a JSON report per run. Same Excel sheet, same engine, no separate audit tool.
- **Reporting** — Playwright HTML report (pass/fail, screenshots, video/trace on failure) plus results written back into the original Excel file for non-technical stakeholders.
- **AI-assisted authoring** (`.agent/`, `prompts/`) — a staged workflow (URL scan → L1 checklist → element/locator extraction → executable L3 steps) where an AI agent drafts the Excel content and a human reviews/approves it.

**Proof of portability:** this framework was originally built for a healthcare client's internal system. All client-identifying data, credentials, and business logic have been removed and replaced with a working demo against the public site [saucedemo.com](https://www.saucedemo.com) — verified with a real passing run across **Chrome, Firefox, and WebKit (Safari engine)**, with zero changes to the core engine. That's the point: the architecture doesn't assume any particular domain or browser.

**Stack:** Playwright, TypeScript, Excel (ExcelJS), Node.js.

---

## 📁 Cấu trúc thư mục dự án

```text
unified-gui-testing-tool/
├── .agent/                    # Cấu hình AI Automation Agent (rules & workflows)
├── prompts/                   # Chứa các file prompt gợi ý cho AI Agent
├── config/
│   ├── global/                # Chứa Excel cấu hình toàn cục & luật chung
│   ├── credentials.env        # File cấu hình tài khoản (Basic Auth...)
│   └── project.yaml           # File cấu hình dự án, môi trường (URL, timeout...)
├── data/
│   ├── {Project_Name}/        # Thư mục chứa kịch bản kiểm thử theo dự án (ví dụ: SauceDemo)
│   │   ├── L1_High_Level/     # File checklist yêu cầu nghiệp vụ (HL_FR_*.xlsx)
│   │   ├── L2_Mid_Level/      # File test plan, business rules (ML_TC_*.xlsx)
│   │   └── L3_Low_Level/      # File kịch bản Master chạy máy chi tiết steps/locators/data (Master_Test_Suite_*.xlsx)
│   ├── 00_Login/              # Thư mục chứa kịch bản và dữ liệu phục vụ test Login
│   └── common/                # Thư mục chứa các file Excel test case dùng chung của từng phân hệ/module
├── reports/                   # Thư mục chứa kết quả chạy test (Excel kết quả, HTML report, screenshots)
├── visual-baselines/          # Ảnh baseline cho keyword check_visual (visual regression) — commit vào Git
├── src/
│   ├── core/
│   │   ├── ExcelReader.ts     # Trình đọc dữ liệu kịch bản từ Excel
│   │   ├── DataResolver.ts    # Biên dịch biến dữ liệu động ($data_...)
│   │   ├── LocatorResolver.ts # Phân tích và lựa chọn locator ưu tiên
│   │   ├── ActionExecutor.ts  # Trình thực thi các keywords kịch bản
│   │   └── ResultWriter.ts    # Trình xuất kết quả kiểm thử về file Excel
│   └── types/
│       └── index.ts           # Định nghĩa các kiểu dữ liệu TypeScript
├── tests/
│   ├── global-setup.ts        # Biên dịch kịch bản Excel thành JSON trung gian trước khi chạy
│   ├── verify-elements.spec.ts# Test kiểm tra tính hợp lệ của các Elements khai báo
│   └── main.spec.ts           # Bộ khung thực thi các bước kiểm thử Playwright động
├── tsconfig.json              # Cấu hình TypeScript Compiler
├── playwright.config.ts       # File cấu hình Playwright Test Runner (projects: chrome, firefox, webkit)
└── package.json               # Khai báo các thư viện phụ thuộc và scripts chạy test
```

---

## 🚀 Hướng dẫn cài đặt & Setup (Từ khi clone mã nguồn)

Thực hiện các bước dưới đây để thiết lập môi trường chạy kiểm thử từ đầu:

### Bước 1: Lấy mã nguồn
```bash
git clone <your-repo-url> unified-gui-testing-tool
```
*(Hoặc di chuyển vào thư mục code hiện tại nếu bạn đã tải về sẵn).*

### Bước 2: Cài đặt NodeJS & Cài đặt các thư viện phụ thuộc
Đảm bảo máy tính của bạn đã cài đặt [Node.js](https://nodejs.org/). Chạy lệnh sau tại thư mục gốc dự án:
```bash
npm install
```

### Bước 3: Cài đặt các trình duyệt Playwright
Cài đặt nhân trình duyệt để Playwright có thể thực thi kịch bản. Framework mặc định dùng 3 project: `chrome` (Chrome thật cài trên máy), `firefox` và `webkit` (đều là bundle sẵn của Playwright):
```bash
npx playwright install firefox webkit
```
*(Project `chrome` dùng Google Chrome đã cài sẵn trên máy qua `channel: "chrome"` — không cần tải riêng.)*

### Bước 4: Tạo cấu hình tài khoản (credentials.env)
Do file `config/credentials.env` chứa thông tin đăng nhập nhạy cảm và không được đẩy lên Git (đã được khai báo trong `.gitignore`), bạn cần tạo file này:

1. Tạo file `credentials.env` trong thư mục `config/` (nếu chưa có).
2. Điền thông tin tài khoản đăng nhập tương ứng, ví dụ:
   ```env
   LOCAL_HTTP_USER=your-username
   LOCAL_HTTP_PASS="your-password"
   ```

---

## 🌐 Cấu hình Môi trường Động & Tương đối hóa URL

Để kiểm thử linh hoạt trên nhiều môi trường (`local`, `test`, `sit`) mà không phải chỉnh sửa file Excel kịch bản, dự án hỗ trợ cấu hình động:

### 1. Khai báo URL môi trường trong file `config/project.yaml`
Bạn có thể cấu hình URL của các môi trường khác nhau và môi trường chạy mặc định trong file `config/project.yaml`. Ví dụ thực tế đang dùng cho demo SauceDemo:
```yaml
project_name: "SauceDemo"
project_label: "SauceDemo Portfolio Demo"
domain: "ecommerce"        # đổi thành domain thật của dự án: healthcare, fintech, education...

base_url:
  local: "https://www.saucedemo.com"
  test: "https://www.saucedemo.com"
  sit: "https://www.saucedemo.com"

default_env: test
```

### 2. Viết URL tương đối trong sheet `PAGE` của file Excel
Trong sheet `PAGE` của file kịch bản, hãy khai báo URL dưới dạng tương đối (bắt đầu bằng `/`):
* `login` → `/`
* `inventory` → `/inventory.html`

Hệ thống sẽ tự động ghép nối `base_url` của môi trường đang chọn với đường dẫn tương đối để tạo ra URL tuyệt đối hoàn chỉnh khi chạy test. (Nếu ghi URL tuyệt đối bắt đầu bằng `http`, hệ thống sẽ tự động thay thế domain cũ bằng domain môi trường hiện tại để tương thích ngược).

### 3. Cơ chế kiểm tra sức khỏe server (Health Check Fail-Fast)
Trước khi chạy test, hệ thống tự động kiểm tra trạng thái hoạt động của server môi trường. Nếu server bị tắt, lỗi mạng, hoặc bạn chưa kết nối VPN, hệ thống sẽ **hủy test ngay lập tức** kèm theo cảnh báo rõ ràng để tránh lãng phí thời gian đợi timeout của từng test case.

---

## 🔁 Quy trình chạy tuần tự Full Flow (Khi làm module mới)

Thực hiện tuần tự qua **6 bước** đơn giản sau để xây dựng và thực thi kiểm thử cho module mới:

```mermaid
flowchart LR
    B0[Bước 0: Khởi tạo Excel L3] ──> B1[Bước 1: Sinh L1 Checklist] ──> B2[Bước 2: Phân rã L2 Test Plan] ──> B3[Bước 3: Nạp Locator ELEMENT] ──> B4[Bước 4: Sinh Test Steps & Data L3] ──> B5[Bước 5: Chạy Test & Báo Cáo]
```

### 🔹 Bước 0: Khởi tạo file kịch bản Excel Master (L3 Low-Level)
1. Khởi tạo file Excel Master cho module tại thư mục tương ứng của tầng L3.
   *(Ví dụ thật đang có trong repo: `data/SauceDemo/L3_Low_Level/Master_Test_Suite_SauceDemo.xlsx` — dùng làm file tham khảo cấu trúc thay vì template rỗng.)*
2. Cấu hình các trang web tại sheet `PAGE` dưới dạng **URL tương đối** (ví dụ: `/`, `/inventory.html`).

### 🔹 Bước 1: Quét URL & Sinh Checklist Bậc 1 (L1 High-Level)
1. Sử dụng prompt mẫu [`prompts/step_01_tc_high_level.txt`](prompts/step_01_tc_high_level.txt) kết hợp với workflow [`.agent/workflows/step_01_tc_high_level.md`](.agent/workflows/step_01_tc_high_level.md).
2. Chat với AI để quét URL trang web thực tế và tự động sinh ra file Excel TC High Level (L1 Checklist) tại `data/{Project_Name}/L1_High_Level/`.

### 🔹 Bước 2: Phân rã Detail Test Cases Bậc 2 (L2 Mid-Level)
1. Sử dụng prompt mẫu [`prompts/step_02_tc_mid_level.txt`](prompts/step_02_tc_mid_level.txt) kết hợp với workflow [`.agent/workflows/step_02_tc_mid_level.md`](.agent/workflows/step_02_tc_mid_level.md).
2. Chat với AI để đọc checklist Bậc 1, phân tích nghiệp vụ và tự động sinh ra bộ kịch bản Detail Test Cases Bậc 2 (L2 Test Plan) tại `data/{Project_Name}/L2_Mid_Level/`.

### 🔹 Bước 3: Khảo sát & Nạp Locator vào sheet ELEMENT (L3 Low-Level)
1. Sử dụng prompt mẫu [`prompts/step_03a_element_sheet.txt`](prompts/step_03a_element_sheet.txt) để yêu cầu AI khảo sát DOM trang đích.
2. AI tự động quét và trích xuất bộ locators ưu tiên (`data-testid`, `id`...), sau đó bạn dán bảng kết quả vào sheet `ELEMENT_<MODULE_UPPER>` (ví dụ: `ELEMENT_SAUCEDEMO`) trong file Excel Master (L3) tương ứng.

### 🔹 Bước 4: Phân rã Test Steps & Sinh dữ liệu vào sheet TEST_CASE/DATA (L3 Low-Level)
1. Sử dụng prompt mẫu [`prompts/step_03_tc_low_level.txt`](prompts/step_03_tc_low_level.txt) và [`prompts/step_03b_test_data.txt`](prompts/step_03b_test_data.txt) kết hợp với workflow [`.agent/workflows/step_03_tc_low_level.md`](.agent/workflows/step_03_tc_low_level.md).
2. AI sẽ đọc kịch bản L2, danh sách element và tự động sinh ra các bước Keyword-driven chạy máy (sheet `TEST_CASE_<MODULE_UPPER>`) cùng dữ liệu biên BVA (sheet `DATA_<MODULE_UPPER>`).

### 🔹 Bước 5: Chạy Test & Đọc kết quả
1. Chạy các lệnh kiểm thử (xem chi tiết ở phần bên dưới) qua CLI Runner hoặc npm scripts.
2. Kết quả test thực tế và ảnh chụp lỗi sẽ tự động được ghi nhận ngược lại file Excel kết quả tại thư mục `reports/`.

---

## 🏃 Hướng dẫn chạy kiểm thử

### 1. Qua npm script (khuyến nghị)
```bash
npm test -- --file=data/SauceDemo/L3_Low_Level/Master_Test_Suite_SauceDemo.xlsx --module=saucedemo --env=test
```
Mặc định chạy trên cả 3 project `chrome`, `firefox` và `webkit` (khai báo trong `playwright.config.ts`). Muốn chạy 1 browser duy nhất, thêm `--project=chrome`, `--project=firefox` hoặc `--project=webkit` vào cuối lệnh.

### 2. Qua CLI Runner động (`run.bat`, Windows)
```powershell
.\run [element/verify] <từ_khóa_tên_file> [local/test/sit/uat]
```
*(Hệ thống sẽ tự động quét thư mục `data/` để tìm file Excel phù hợp nhất với từ khóa, tự động lọc module và xác định môi trường tương ứng).*

Ví dụ:
```powershell
.\run element saucedemo local     # Bước kiểm tra Element trước khi chạy thật
.\run saucedemo local              # Thực thi kịch bản test trên môi trường local
```

---

## 🖼️ Visual Regression Testing (`check_visual`)

Ngoài các keyword kiểm tra logic (`check_status`, `check_value`), framework hỗ trợ so sánh **ảnh chụp pixel-diff** để bắt các lỗi UI mà assertion văn bản không thấy được (lệch layout, vỡ CSS, sai màu, đè chữ...).

### 1. Thêm bước `check_visual` vào sheet TEST_CASE (giống mọi keyword khác)

| step | action | target | value | expected |
|---|---|---|---|---|
| 5 | check_visual | *(để trống)* | *(để trống)* | *(để trống)* |
| 6 | check_visual | card_product_list | | mask:lbl_updated_at |
| 7 | check_visual | | homepage_hero | threshold:0.05 |

* **Target**: ID phần tử trong `ELEMENT` để chụp riêng 1 vùng, hoặc để trống / `page` để chụp toàn trang.
* **Value**: tên file baseline tùy chọn (không bắt buộc — mặc định tự sinh `TCID_stepN_target.png`).
* **Expected** (tùy chọn):
  * `mask:element_id_1,element_id_2` — che các vùng có nội dung động (timestamp, avatar, số liệu realtime...) trước khi so sánh, tránh false positive.
  * `threshold:0.05` (hoặc viết tắt `0.05`) — nới ngưỡng % pixel khác biệt cho phép, ghi đè giá trị mặc định `maxDiffPixelRatio: 0.01` khai báo trong `playwright.config.ts`.

### 2. Tạo ảnh baseline lần đầu

Lần chạy đầu tiên cho mỗi bước `check_visual` sẽ luôn FAILED vì chưa có ảnh gốc để so sánh — đây là hành vi đúng của Playwright, không phải lỗi. Chạy lại kèm cờ `--update-snapshots` để chấp nhận ảnh hiện tại làm baseline:

```bash
npm test -- --file=data/SauceDemo/L3_Low_Level/Master_Test_Suite_SauceDemo.xlsx --module=saucedemo --env=test --update-snapshots
```

Ảnh baseline được lưu tại `visual-baselines/` (đã cấu hình trong `playwright.config.ts`, **commit vào Git** — đây chính là "expected result" của bộ test, không phải file build tạm). Tên file tự động kèm theo browser (`chrome`/`firefox`/`webkit`) và platform, vì mỗi engine render khác nhau vài pixel — nghĩa là bạn cần chạy `--update-snapshots` **cho từng project** muốn hỗ trợ visual test.

### 3. Các lần chạy sau

Chạy bình thường như mọi test khác — `check_visual` tự so sánh ảnh hiện tại với baseline đã commit và trả PASSED/FAILED. Khi FAILED, ảnh `-actual`/`-diff`/`-expected` được ghi vào `reports/test-results/` để xem trực quan chỗ lệch (mở qua `npm run report:open`).

**Lưu ý với test case data-driven (parameterized = Y):** baseline được đặt tên cố định theo `tc_id + step`, không tự thêm số thứ tự iteration. Nếu giao diện thực sự đổi theo từng bộ dữ liệu, hãy đặt tên riêng ở cột Value (có thể tham chiếu `$data_...`) cho mỗi iteration để tránh so sánh nhầm baseline.

---

## ♿ Accessibility Testing (`check_a11y`)

Quét lỗi accessibility/WCAG bằng [axe-core](https://github.com/dequelabs/axe-core) — cùng bộ máy, cùng sheet Excel, không cần công cụ audit riêng.

### 1. Thêm bước `check_a11y` vào sheet TEST_CASE

| step | action | target | value | expected |
|---|---|---|---|---|
| 3 | check_a11y | *(để trống)* | *(để trống)* | *(để trống)* |
| 4 | check_a11y | form_checkout | | tags:wcag2a,wcag2aa |
| 5 | check_a11y | | | disable:color-contrast;exclude:.third-party-widget |
| 6 | check_a11y | | | severity:critical,serious |

* **Target**: ID phần tử trong `ELEMENT` để quét riêng 1 khu vực, hoặc để trống / `page` để quét toàn trang.
* **Value**: tên file report JSON tùy chọn (không bắt buộc — mặc định tự sinh `a11y_TCID_stepN.json`).
* **Expected** (tùy chọn, kết hợp bằng `;`):
  * `disable:rule-id-1,rule-id-2` — tắt tạm các rule đã biết là false-positive hoặc chưa kịp fix.
  * `exclude:.selector` — loại 1 vùng DOM khỏi phạm vi quét (banner quảng cáo, widget bên thứ 3 không kiểm soát được...).
  * `tags:wcag2a,wcag2aa` — giới hạn chỉ chạy rule thuộc chuẩn WCAG chỉ định (mặc định: toàn bộ rule của axe-core).
  * `severity:critical,serious` — chỉ coi là FAILED khi có vi phạm ở mức này trở lên (mặc định: fail với mọi mức, kể cả `minor`).

### 2. Đọc kết quả

* **PASSED**: cột Observed ghi rõ đã quét toàn trang hay 1 phần tử, ở mức severity nào.
* **FAILED**: cột Observed liệt kê số lượng vi phạm theo mức độ + tóm tắt từng rule (id, mô tả, số phần tử ảnh hưởng).
* **Chi tiết đầy đủ** (kể cả khi PASSED, phục vụ audit lâu dài): file JSON tại `reports/{run_id}/a11y/*.json` — chứa nguyên bản kết quả axe-core (`nodes`, `html`, `failureSummary`...) cho từng vi phạm.

**Lưu ý:** axe-core bắt lỗi cấu trúc DOM/ARIA (thiếu `alt`, tương phản màu, thiếu label, thứ tự heading sai...) — không thay thế được kiểm thử với screen reader thật hoặc điều hướng bàn phím thủ công. Dùng làm lớp lọc tự động trước, không phải chứng nhận WCAG đầy đủ.

---

## 📊 Xem báo cáo kết quả kiểm thử

Sau mỗi lượt chạy kiểm thử hoàn tất, framework sẽ tự động kết xuất kết quả ra hai nơi:

### 1. File Excel kết quả
Lưu tại `reports/run_<ENV>_<TÊN_FILE>_<TIMESTAMP>/` — bao gồm file Excel kết quả (`*_result.xlsx`), ảnh chụp màn hình lỗi (`screenshots/`), và báo cáo tóm tắt tự động (`summary_report.md`) phân tích nguyên nhân lỗi theo nhóm.

### 2. Báo cáo HTML của Playwright
```bash
npm run report:open
```
Báo cáo này hiển thị chi tiết các bước chạy thành công/thất bại kèm theo ảnh chụp màn hình minh chứng hoặc video/trace log khi xảy ra lỗi.
