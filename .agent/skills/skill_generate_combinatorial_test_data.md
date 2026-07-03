---
name: generate_combinatorial_test_data
description: Hướng dẫn phân tích ma trận kết hợp đa chiều (Pair-wise/Orthogonal Array) và sinh dữ liệu kiểm thử tổ hợp hoàn chỉnh.
---

# Skill: Sinh Dữ liệu Kiểm thử Tổ hợp (Generate Combinatorial Test Data)

**Mục tiêu:** Quy trình từng bước hướng dẫn AI Agent tiếp nhận ma trận kết hợp đa chiều (Combinatorial Matrix / Pair-wise), phân tích các trường dữ liệu và ràng buộc của từng module trong chuỗi liên kết (Cross-Module), từ đó sinh ra bộ dữ liệu kiểm thử tổ hợp hoàn chỉnh định dạng Markdown/Excel (hoặc tự động nạp chạy thật để tạo dữ liệu trên hệ thống).

---

## 📥 ĐẦU VÀO CẦN THIẾT TỪ USER

| Thông tin đầu vào | Mức độ bắt buộc | Mô tả |
| :--- | :---: | :--- |
| **Ma trận kết hợp** | Bắt buộc ✅ | Bảng ma trận kết hợp đa chiều (Pair-wise/Orthogonal Array) từ kịch bản test plan. |
| **Danh sách Fields & Rules** | Bắt buộc ✅ | Danh sách các trường nhập liệu của từng module trong chuỗi kèm ràng buộc nghiệp vụ. |
| **Định dạng đầu ra** | Tùy chọn ❌ | Mặc định là `Markdown Table` (cho sheet `DATA_*`) hoặc `JSON`. |

---

## 🔁 CÁC BƯỚC THỰC HIỆN

### Bước 1: Phân tích Ma Trận & Fields
1. **Đọc và Phân rã Ma Trận:**
   * Xác định số lượng Dimensions (D1, D2, D3...) và các giá trị kết hợp tương ứng của từng tổ hợp (Combo 01, Combo 02,...).
2. **Phân loại các trường nhập liệu (Fields classification):**
   * **Dimension field:** Các trường mang giá trị của ma trận kết hợp (PHẢI giữ chính xác giá trị theo combo, KHÔNG sinh ngẫu nhiên).
   * **Supporting field:** Các trường bắt buộc đi kèm nhưng không nằm trong ma trận (Sinh random + unique + traceable).
   * **Reference field:** Trường kế thừa ID/code từ kết quả của module trước trong chuỗi (ví dụ: lấy `partner_id` của module 1 làm đầu vào cho module 2).
   * **Computed field:** Trường tự động tính toán dựa trên công thức nghiệp vụ (ví dụ: `total = amount * 1.10`).

---

### Bước 2: Sinh dữ liệu Tổ hợp (Generate)
1. **Sinh dữ liệu cho từng bộ tổ hợp (Combo):**
   * Đảm bảo tính độc nhất: Dùng cấu trúc đặt tên traceable: `auto_combo{XX}_{module_short}_{timestamp}` (Ví dụ: `auto_c01_partner_1712049200`).
   * Các giá trị tính toán (Computed fields) phải được tính đúng theo công thức nghiệp vụ.
2. **Đóng gói bảng kết quả dạng Markdown Table:**
   * Cột đầu tiên bắt buộc là `test_case_type` (định danh cho kịch bản, ví dụ: `TC_PAYMENT_001_COMBO01`).
   * Các cột tiếp theo là tên biến tương ứng trong test steps.

---

## 📋 ĐẦU RA YÊU CẦU (OUTPUT FORMAT)

```markdown
### 📊 Bộ Dữ liệu Kiểm thử Tổ hợp (Markdown Table)
*Copy bảng dưới đây và ghi đè vào sheet `DATA_<MODULE_NAME>` của file Excel:*

| test_case_type | partner_type | currency | tax_type | partner_name | amount | tax_amount | expected_total |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC_PAY_001_COMBO01 | Tổ chức | VND | VAT 10% | auto_c01_partner_1712049200 | 100000000 | 10000000 | 110000000 |
| TC_PAY_001_COMBO02 | Cá nhân | USD | PIT 5% | auto_c02_partner_1712049200 | 5000 | 250 | 5250 |
```

---

## 🚫 CÁC QUY TẮC NGHIÊM NGẶT (STRICT RULES)

- **`EP-02` (Giá trị Dimension rời rạc):** Cấm random hoặc thay đổi các giá trị thuộc Dimension của ma trận kết hợp. Mọi giá trị rời rạc phải được ánh xạ chính xác theo phân vùng (Tham chiếu: [Rule EP-02](../rules/test_design_rules.md#rule-ep-02) và [Rule PW-01](../rules/test_design_rules.md#rule-pw-01)).
- **`CR-03` (Logic nghiệp vụ):** Các Computed values (như số tiền thuế, tổng cộng...) phải được tính toán chính xác 100% theo logic nghiệp vụ của ma trận kết hợp, không sinh giá trị ngẫu nhiên (Tham chiếu: [CR-03](../rules/test_design_rules.md#cr-03)).
- **`CR-05` (Cấu trúc bảng dữ liệu):** Bắt buộc cột đầu tiên trong bảng dữ liệu đầu ra phải đặt tên là `test_case_type` để mapping tự động khớp với kịch bản test (Tham chiếu: [CR-05](../rules/test_design_rules.md#cr-05)).
