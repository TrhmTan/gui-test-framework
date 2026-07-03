# Quy Tắc Dành Riêng Cho Playwright — unified-gui-testing-tool

> Áp dụng khi Agent sử dụng Playwright MCP để debug UI hoặc Engine chạy test bằng Playwright TypeScript.

---

## 1. Thiết Lập Browser (BẮT BUỘC)

- **Viewport debug:** Mọi quá trình debug UI bắt buộc chạy với viewport desktop: **`1920x1080`**.
- **Headed mode:** Bắt buộc mở browser có hiển thị (headed) trong quá trình debug và thiết lập test mới.
- **Headless mode:** Chỉ được phép sử dụng khi test đã debug PASS 100% trên headed mode, hoặc trong CI/CD.

---

## 2. Quy Trình Debug Bắt Buộc (Playwright MCP)

Khi sử dụng Playwright MCP để tương tác hoặc debug UI, **LUÔN LUÔN** tuân thủ đúng thứ tự:

```
1. navigate   → điều hướng đến URL đúng
2. resize     → 1920×1080 (LUÔN gọi ngay sau navigate)
3. wait_for   → đợi page load hoàn tất
4. snapshot   → quét DOM để xác định locator thực tế
5. interact   → click / input / select
6. screenshot → chụp ảnh khi assertion fail hoặc tại mốc kiểm thử quan trọng
```

> [!IMPORTANT]
> **KHÔNG** gọi lại lệnh `navigate` nếu trang hiện tại đã đúng địa chỉ — tránh reload trang không cần thiết.

---

## 3. Thứ Tự Ưu Tiên Locator Playwright

> Tham khảo đầy đủ: [locator_strategy.md](locator_strategy.md)

**Cho dự án này — ưu tiên `data-testid` cao nhất:**

| Thứ tự | Playwright Method | Khi nào dùng |
| :--- | :--- | :--- |
| **1** | `page.getByTestId('value')` | Có `data-testid` → **BẮT BUỘC dùng** |
| **2** | `page.getByLabel('label text')` | Form field có `<label>` rõ ràng |
| **3** | `page.getByPlaceholder('text')` | Input có placeholder |
| **4** | `page.getByRole('button', {name: '...'})` | Button / link semantic |
| **5** | `page.getByText('text')` | Text content duy nhất |
| **6** | `page.locator('#id')` | Có stable `id` |
| **7** | `page.locator('[name="..."]')` | Có stable `name` |
| **8** | `page.locator('css selector')` | CSS ổn định (không dùng class hash) |
| **9 (cuối)** | `page.locator('xpath=...')` | XPath khi không còn cách nào khác |

---

## 4. Quy Tắc Wait & Timeout

- **KHÔNG** dùng `waitForTimeout(ms)` với giá trị millisecond tĩnh (hard sleep) — vi phạm [NO_HARDCODE.md](no_hardcode.md).
- Thay vào đó, dùng các smart wait sau:

  ```typescript
  // ✅ ĐÚNG — chờ element visible
  await page.locator('[data-testid="btn-save"]').waitFor({ state: 'visible' });

  // ✅ ĐÚNG — chờ navigation
  await page.waitForURL('**/screening*');

  // ✅ ĐÚNG — chờ response API
  await page.waitForResponse(resp => resp.url().includes('/api/save'));

  // ❌ SAI — hard sleep không được phép
  await page.waitForTimeout(3000);
  ```

---

## 5. Assertions

- **Chỉ assert trong bước `check_status` trong Excel** — KHÔNG viết assertion hard-coded trong Engine code.
- Assertion phải có message rõ ràng:

  ```typescript
  // ✅ ĐÚNG
  await expect(page.getByTestId('toast-success')).toBeVisible({
    message: 'Toast thành công phải hiển thị sau khi lưu'
  });

  // ❌ SAI — không có message
  await expect(locator).toBeVisible();
  ```

---

## 6. Screenshot Rules

- **Chụp ảnh khi:** Assertion fail, toast hiển thị, popup/modal xuất hiện quan trọng.
- **KHÔNG chụp ảnh tràn lan** — mỗi test case tối đa 3-5 screenshot (tiết kiệm resource).
- Lưu screenshot vào: `test-results/{module}/{test_case_id}_{timestamp}.png`

---

## 7. NGHIÊM CẤM

- ❌ Đoán mò locator mà không inspect DOM thực tế.
- ❌ Copy locator từ code cũ mà không verify sự tồn tại trên UI thật.
- ❌ Dùng CSS class hash động: `.css-1n2xyz`, `.Button-abc123`.
- ❌ Dùng XPath vị trí: `//div[3]/table/tbody/tr[2]`.
- ❌ Dùng `waitForTimeout()` với giá trị static.
- ❌ Commit file chứa credentials thật lên repository.

---

## 8. Khóa Phạm Vi URL (URL Scope Lock)

- **Quy tắc:** Agent chỉ được phép tương tác và quét DOM trên URL được chỉ định trong cấu hình test (`URL` trong CONTEXT).
- **Hành vi cấm:** Cấm click vào các thanh menu điều hướng bên lề (sidebar), thanh menu hệ thống (header), hoặc link ngoài trang nếu hành động đó làm thay đổi URL hiện tại ra khỏi scope.
- **Xử lý redirect:** Nếu trang web tự động chuyển hướng (do hết session hoặc chuyển trang tự động), Agent phải đăng nhập lại (nếu cần) và dùng lệnh điều hướng `navigate` để quay lại chính xác URL mục tiêu ngay lập tức, tuyệt đối không được tiếp tục thao tác trên URL sai lệch.
- **Quy tắc đối với Browser Subagent:** Khi Agent chính khởi tạo và gọi `browser_subagent` (subagent trình duyệt), **bắt buộc phải truyền kèm quy tắc URL Scope Lock (RULE-04)** vào trong prompt `Task` của subagent. Subagent phải liên tục tự kiểm tra URL hiện tại của trang, nếu phát hiện bị chuyển hướng ngoài scope (như click nhầm menu header/sidebar sang trang `/cashier`), subagent bắt buộc phải dùng lệnh điều hướng `navigate` quay lại đúng URL mục tiêu ngay lập tức trước khi thực hiện bước tiếp theo.
