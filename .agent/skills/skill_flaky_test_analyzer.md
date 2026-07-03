---
name: flaky_test_analyzer
description: Skill phân tích và khắc phục các automation test không ổn định (flaky tests) trong framework unified-gui-testing-tool — xác định root cause và đề xuất fix.
---

# Flaky Test Analyzer

**Mục đích:** Phân tích log lỗi, stack trace và screenshot khi test case bị fail không ổn định (lúc pass lúc fail) — xác định nguyên nhân gốc và đề xuất phương án sửa phù hợp với cấu trúc Excel + Playwright của dự án.

---

## When to Use

Sử dụng skill này khi:
- Một test case lúc chạy được lúc không (pass/fail intermittently)
- Kết quả chạy test không nhất quán giữa các lần run
- CI/CD pipeline báo lỗi nhưng chạy tay lại pass

---

## Root Cause Categories

Flaky test trong dự án này thường xuất phát từ 5 nguyên nhân chính:

| # | Nguyên nhân | Dấu hiệu |
| :--- | :--- | :--- |
| 1 | **Locator không ổn định** | `Error: locator.click: Timeout`, element không tìm thấy |
| 2 | **Timing / Race condition** | Test fail khi mạng chậm, page load chưa xong |
| 3 | **Dữ liệu test bị conflict** | Chạy parallel, dữ liệu cùng tên bị override |
| 4 | **Môi trường không ổn định** | External service down, session hết hạn |
| 5 | **Precondition không được reset** | Data từ test case trước làm ảnh hưởng test sau |

---

## Execution Modes & Workflow

Kỹ năng này hoạt động dưới 2 chế độ (chọn theo yêu cầu của người dùng):

| Chế độ | Mô tả | Kết quả đầu ra |
| :--- | :--- | :--- |
| **ANALYZE** (Mặc định) | Tìm nguyên nhân gây lỗi flaky, chưa tự động sửa file Excel kịch bản. | Báo cáo phân tích nguyên nhân gốc rễ + Đề xuất sửa đổi. |
| **FIX** | Tự động sửa đổi và kiểm chứng độ ổn định ngay lập tức. | Cập nhật trực tiếp file Excel kịch bản + Kết quả verify (3 lần liên tiếp). |

---

## 🔁 Các Bước Thực Hiện Chi Tiết

### Bước 1: Thu thập thông tin & Tái hiện lỗi
1. **Khảo sát kịch bản hiện tại:** Đọc file Excel kịch bản `Master_Test_Suite_*.xlsx` tại các sheet liên quan (`TEST_CASE_*`, `ELEMENT_*`, `DATA_*`) của test case bị báo lỗi.
2. **Khởi chạy tái hiện lỗi:** Chạy kịch bản test **3 lần liên tiếp** để kiểm tra tần suất và tính ngẫu nhiên của lỗi:
   ```bash
   npm run test -- --grep "TC_ID_CẦN_MỞ"
   ```
3. Ghi nhận log console, so sánh thông báo lỗi và ảnh chụp màn hình lưu tại thư mục `reports/` để tìm điểm bất thường.

### Bước 2: Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
Đối chiếu log lỗi với bảng phân loại `Root Cause Categories` ở trên để xác định nhóm nguyên nhân.

### Bước 3: Đề xuất & Báo cáo Phân tích (CHECKPOINT ⏸️)
Trình bày báo cáo chi tiết cho người dùng và chờ phản hồi (nếu ở chế độ FIX):
* Phương án sửa đổi (Sửa locator, Thêm smart wait, hay sửa Test Data).
* Xin xác nhận đồng ý từ người dùng trước khi tiến hành sửa đổi file Excel.

### Bước 4: Sửa đổi kịch bản Excel (Mode FIX)
*Thực hiện sau khi người dùng xác nhận đồng ý.*
* Sử dụng các công cụ chỉnh sửa để cập nhật trực tiếp vào file Excel `Master_Test_Suite_*.xlsx` theo các chiến lược bên dưới.

### Bước 5: Verify & Đảm bảo ổn định (Stability Verification)
1. Khởi chạy lại kịch bản test case vừa sửa **3 lần liên tiếp**:
   ```bash
   npm run test -- --grep "TC_ID_CẦN_MỞ"
   ```
2. **Đánh giá kết quả verify:**
   * **3/3 Lần PASS:** Test case đã hoàn toàn ổn định $\to$ Cập nhật báo cáo thành công và gắn nhãn **✅ STABILIZED**.
   * **Có lần FAIL:** Tiếp tục phân tích log fail mới và lặp lại tối đa 3 vòng sửa. Nếu không khắc phục được, rollback các thay đổi và báo cáo lại người dùng.

---

## Fix Strategies

### 🔴 1. Locator không ổn định
**Phương án sửa:**
1. Dùng Playwright MCP mở trang, quét DOM thực tế.
2. Tìm `data-testid` của element đó.
3. Cập nhật lại `locator_type = data-testid` và `locator_value` tương ứng trong file Excel.
4. Tham khảo: [locator_strategy.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/locator_strategy.md) và [skill_smart_locator_agent.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/skills/skill_smart_locator_agent.md).

```
❌ TRƯỚC: locator_type = css, locator_value = .Button-abc123 span
✅ SAU:   locator_type = data-testid, locator_value = btn-save-vital
```

### 🟡 2. Timing / Race Condition
**Phương án sửa:**
- **KHÔNG** thêm `wait_for` với giá trị timeout tĩnh vô căn cứ.
- Thêm bước `check_status` (hoặc `wait_for` cho sự kiện bất đồng bộ) với `expected = visible` hoặc `expected = enabled` trước bước tương tác.

```
❌ TRƯỚC: action = click | target = btn_save (ngay sau khi navigate, không chờ)
✅ SAU:   Thêm bước: action = wait_for | target = btn_save | expected = enabled (nếu là chuyển trang chậm)
         Sau đó:    action = click    | target = btn_save
```

### 🔵 3. Data Conflict khi chạy Parallel
**Phương án sửa:**
- Đảm bảo mỗi dòng data trong sheet `DATA_{MODULE}` có `test_case_type` unique.
- Với các trường unique như email, số điện thoại, thêm `${timestamp}` hoặc suffix ngẫu nhiên vào `value`.

### ⚪ 4. Session hết hạn / Môi trường không ổn định
**Phương án sửa:**
- Đảm bảo bước đầu tiên của test case gọi precondition đăng nhập (`pre_login_xxx`).

### 🟢 5. Precondition không được reset
**Phương án sửa:**
- Thêm bước cleanup ở cuối test case hoặc thêm precondition reset data vào đầu test.

---

## Strict Rules

### FL-01
Không được thêm `wait_for` với giá trị millisecond tĩnh (ví dụ: `value = 5000`) mà không có lý do bất khả kháng. Bắt buộc tuân thủ nghiêm ngặt quy tắc tại [no_hardcode.md](file:///c:/Users/your-username/Documents/projects/unified-gui-testing-tool/.agent/rules/no_hardcode.md).

### FL-02
Sau khi sửa đổi (fix), bắt buộc phải chạy lại kịch bản test case tối thiểu **3 lần liên tiếp** và đều đạt trạng thái PASS trên môi trường thử nghiệm trước khi báo cáo hoàn thành.

### FL-03
Báo cáo rõ ràng và chi tiết về: `element_id` bị fix, thông tin `locator_type` + `locator_value` cũ/mới, và phân loại nguyên nhân gốc rễ (Root Cause Category) theo quy chuẩn.

---

## Self-Checklist

- [ ] Đã đọc log lỗi và screenshot trong cột `[o]_screenshot` của Excel kết quả.
- [ ] Đã xác định được đúng root cause theo 5 category.
- [ ] Locator fix đã ưu tiên `data-testid` trước.
- [ ] Không thêm hard sleep (`wait_for` với millisecond tĩnh).
- [ ] Đã chạy lại test case ít nhất 3 lần liên tiếp và đều PASS.

