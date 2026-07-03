# .agent — Bộ Quy Tắc & Kỹ Năng cho AI Agent

Thư mục này chứa toàn bộ **Rules, Skills, và Workflows** dành riêng cho AI Agent (Antigravity) khi làm việc trong dự án **unified-gui-testing-tool**.

---

## 📂 Cấu Trúc

```
.agent/
├── rules/                  # Quy tắc bắt buộc — luôn áp dụng
│   ├── automation_rules.md     # Quy tắc chung cho QA Automation
│   ├── excel_conventions.md    # Quy chuẩn format file Excel
│   ├── locator_strategy.md     # Chiến lược chọn locator (ưu tiên data-testid)
│   ├── no_hardcode.md          # Nguyên tắc không hardcode
│   ├── playwright_rules.md     # Quy tắc riêng cho Playwright
│   └── test_design_rules.md    # Quy tắc thiết kế test case (ISTQB)
│
├── skills/                 # Kỹ năng chuyên biệt — dùng khi cần
│   ├── skill_flaky_test_analyzer.md    # Phân tích và sửa test flaky
│   ├── skill_generate_l1_checklist.md  # Sinh file Excel L1 từ URL hoặc BRD
│   ├── skill_l2_test_plan_generator.md # Quy trình thiết kế và sinh L2 Test Plan
│   └── skill_smart_locator_agent.md    # Quét DOM và sinh locator tự động
│
└── workflows/              # Quy trình thực thi — từng bước cụ thể
    ├── analyze_flaky_tests.md          # Quy trình phân tích và sửa test flaky
    ├── generate_combinatorial_test_data.md # Quy trình tạo test data tổ hợp
    ├── generate_report.md              # Quy trình tạo báo cáo
    ├── generate_test_data.md           # Quy trình sinh test data biên/One-wise
    ├── step_01_tc_high_level.md        # Bước 1: Sinh kịch bản mức High-Level (L1)
    ├── step_02_tc_mid_level.md         # Bước 2: Sinh kịch bản mức Mid-Level (L2)
    ├── step_03_tc_low_level.md         # Bước 3: Sinh kịch bản mức Low-Level (L3)
    └── validate_excel.md               # Quy trình validate Excel L3 Master
```

---

## ⚡ Slash Commands — Theo Flow 3 Bước & Công Cụ Hỗ Trợ

```
🌐 URL  →  STEP 1 (/l1-checklist)  →  STEP 2 (/l1-to-l2)  →  STEP 3 (/l2-to-l3)  →  RUN (/run-test)
```

| Bước / Phân loại | Lệnh Slash | Workflow tương ứng | Mô tả |
| :--- | :--- | :--- | :--- |
| **STEP 1** | `/init-project` hoặc `/tc-high-level` | `workflows/step_01_tc_high_level.md` | Quét URL → sinh TC High Level (L1 Excel Checklist, 5 cột) |
| **STEP 2** | `/l1-to-l2` hoặc `/tc-mid-level` | `workflows/step_02_tc_mid_level.md` | Từ L1 Checklist → sinh TC Mid Level (L2 Excel: test_case + rule sheet) |
| **STEP 3** | `/l2-to-l3` hoặc `/tc-low-level` | `workflows/step_03_tc_low_level.md` | Từ L2 Test Plan → sinh TC Low Level (L3 Excel Master: 3 sheet) |
| **Test Data** | `/gen-test-data` | `workflows/generate_test_data.md` | Sinh dữ liệu sheet DATA theo kỹ thuật biên BVA + One-wise |
| **Test Data** | `/generate_combinatorial_test_data` | `workflows/generate_combinatorial_test_data.md` | Phân tích ma trận kết hợp đa chiều và sinh dữ liệu tổ hợp |
| **Validate** | `/validate-excel` | `workflows/validate_excel.md` | Kiểm tra toàn diện file Excel L3 Master theo quy chuẩn định dạng |
| **Report** | `/gen-report` | `workflows/generate_report.md` | Tổng hợp kết quả từ test suite và sinh báo cáo kiểm thử |
| **Analyze** | `/analyze-flaky` | `workflows/analyze_flaky_tests.md` | Phân tích log, tái hiện lỗi và tìm nguyên nhân gốc rễ của test flaky |

---

## 🔑 Nguyên Tắc Cốt Lõi

1. **data-testid là số 1** — Khi quét DOM, luôn tìm và ưu tiên `data-testid` trước mọi loại locator khác.
2. **KHÔNG đoán mò** — Mọi locator phải được verify từ DOM thực tế (Playwright MCP snapshot).
3. **KHÔNG hardcode** — URL, credentials, timeout cứng đều phải đọc từ `config/project.yaml` hoặc `config/credentials.env`.
4. **Cơ cấu Config-Driven Login** — File cấu hình toàn cục `config/global/global_config.xlsx` bắt buộc phải giữ đúng cấu trúc:
   * **Sheet `PRECONDITION`**: Chứa các bước kịch bản chạy login dùng chung (`pre_super_admin_login_success`, `pre_login_nurse`...).
   * **Sheet `ELEMENT_LOGIN`**: Chứa định nghĩa các element locator phục vụ riêng cho login (element_id, locator_type, locator_value).
   * **Sheet `PAGE`**: Chứa đường dẫn tương đối/tuyệt đối của các page theo page_key.
5. **KHÔNG tự ý sửa `src/`** — Engine code không được tự ý thay đổi trừ khi được yêu cầu mở rộng keyword action mới.
6. **Dọn sạch cuối nhiệm vụ** — Xóa mọi file debug tạm trong `tmp/` trước khi báo cáo hoàn thành.

---

## 📖 Tài Liệu Tham Khảo Nhanh

- Quy chuẩn Excel → [excel_conventions.md](rules/excel_conventions.md)
- Chiến lược locator → [locator_strategy.md](rules/locator_strategy.md)
- Thiết kế test case (ISTQB) → [test_design_rules.md](rules/test_design_rules.md)
- Quy tắc Playwright → [playwright_rules.md](rules/playwright_rules.md)
- Quy tắc không hardcode → [no_hardcode.md](rules/no_hardcode.md)
- Quy tắc chung QA Automation → [automation_rules.md](rules/automation_rules.md)
