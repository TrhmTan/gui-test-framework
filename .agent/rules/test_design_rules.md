# TEST DESIGN RULES

**Luật này áp dụng BẮT BUỘC cho mọi tác vụ sinh Test Case và Test Data.**

> **Cấp độ**: Cấp 3 — Skill/Workflow Rule  
> **Phạm vi**: KHÔNG TỰ LOAD — CẦN CHỈ ĐỊNH trong Skill hoặc Workflow cụ thể  
> **Cách gọi**: Nhúng dòng `Áp dụng nghiêm ngặt .agent/rules/TEST_DESIGN_RULES.md` vào Skill/Workflow

### Mục đích

---

### Thứ tự phân tích 
```
Bước 1: Phân tích theo kỹ thuật Phân vùng tương đương
Bước 2: Phân tích theo kỹ thuật Phân tích giá trị biên
Bước 3: Phân tích theo kỹ thuật One-wise testing
Bước 4: Phân tích theo kỹ thuật Pair-wise testing
Bước 5: Áp dụng tất cả các rule để tạo test case
```

---

## 1. Phân vùng tương đương (EP — Equivalence Partitioning)

### Định nghĩa

Vùng tương đương là tập hợp các giá trị đầu vào (có thể liên tục hoặc rời rạc) của một tham số được xử lý theo cùng một cách.

Ví dụ: Cho tính năng Duyệt điều kiện vay vốn như sau:

Khách hàng có tuổi >= 18,  <= 60, và thu nhập >= 20 triệu VND được phép vay vốn

Có 2 tham số đầu vào với các vùng tương đương như sau:

Phân vùng tương đương là kỹ thuật thiết kế test, theo đó, dữ liệu của các tham số đầu vào được chia thành các vùng tương đương, và với mỗi vùng tương đương, có ít nhất 1 giá trị được chọn để tạo test case.

```
Tham số Tuổi:
Vùng tương đương 1: tuổi >= 18, <= 60 (vùng hợp lệ)
Vùng tương đương 2: tuổi >=0, <= 17 (vùng không hợp lệ)
Vùng tương đương 3: tuổi >= 61 (vùng không hợp lệ) 

Tham số Thu nhập:
Vùng tương đương 1: thu nhập >= 20 triệu VND
Vùng tương đương 2: thu nhập >=0, <= 19.999.999 VND
```

### Cách áp dụng:

Bước 1: Chia các dữ liệu đầu vào của mỗi tham số của tính năng thành các vùng hợp lệ (Valid) và không hợp lệ (Invalid) (nếu có) trước khi sinh data.

Bước 2: Với mỗi vùng tương đương là tập hợp các giá trị liên tục (một dải giá trị), chọn 1 giá trị để tạo thành test case. Với mỗi vùng tương đương là tập hợp các giá trị rời rạc, chọn mỗi giá trị để tạo thành test case.

### Rule EP-01

Mỗi vùng tương đương là tập hợp của các giá trị liên tục, có ít nhất 1 giá trị được chọn để tạo test case. 

Ví dụ: Dữ liệu LIÊN TỤC (khoảng số, độ dài chuỗi)

Chọn **tối thiểu 1 giá trị đại diện nằm giữa** phân vùng.

**SAI** ❌:

```
test_case_type: pos
weight: Nhập giá trị hợp lệ
```

> Lý do sai: Không có giá trị cụ thể, AI hoặc QC không biết test cái gì.

**ĐÚNG** ✅:

```
test_case_type: pos_tc_016
weight: 70
```

> Giá trị `70` nằm giữa vùng hợp lệ (VD: 1–300 kg), đại diện cho cả vùng.

### Rule EP-02

Mỗi vùng tương đương là tập hợp của các giá trị rời rạc, mỗi giá trị rời rạc được chọn để tạo test case. 

Ví dụ: Dữ liệu RỜI RẠC (dropdown, radio, checkbox, enum)

- **CẤM** chỉ chọn 1 giá trị đại diện.
- **BẮT BUỘC** đưa TẤT CẢ các tùy chọn rời rạc vào các iteration riêng biệt.

**SAI** ❌:

```
test_case_type | payment_method
pos            | Thẻ tín dụng      ← chỉ test 1, bỏ sót 2 tùy chọn khác
```

**ĐÚNG** ✅:

```
test_case_type | payment_method
pos_pay_01     | Thẻ tín dụng
pos_pay_02     | Chuyển khoản
pos_pay_03     | Ví điện tử
```

> Cả 3 tùy chọn dropdown đều có test case riêng biệt.

### 1.3 Quy tắc chung

- **CẤM** ghi mơ hồ: "Nhập giá trị hợp lệ", "Nhập giá trị không hợp lệ".
- **BẮT BUỘC** ghi giá trị thực tế cụ thể trong sheet DATA hoặc bước test.
- **LUÔN LUÔN** áp dụng EP *trước* BVA.

---

## 2. Phân tích giá trị biên (BVA — Boundary Value Analysis)

### Định nghĩa

Giá trị biên là giá trị min, max của một dải giá trị (value range)

Phân tích giá trị biên là kỹ thuật thiết kế test theo đó các giá trị min, max của các vùng đương đương mà là một giá trị được chọn để tạo test case.

### Cách áp dụng

Bước 1. Xác định các vùng tương đương (xem phần 1)
Bước 2. Với mỗi vùng tương đương, xác định các giá trị min, max
Bước 3. Chọn mỗi giá trị min, max để tạo test case.

### Rule BVA-01

Với mỗi vùng tương đương là dải giá trị mà có giá trị min và max, tạo test case tương ứng cho mỗi giá trị này.

### Rule BVA-02

Với mỗi vùng tương đương là dải giá trị mà thiếu giá trị min, thì xác định giá trị max + ε của vùng tiếp giáp để tạo test case, trong đó ε là một sai số phù hợp với kiểu dữ liệu của tham số và phù hợp với tham số (tbd)

### Rule BVA-03

Với mỗi vùng tương đương là dải giá trị mà thiếu giá trị max, thì xác định giá trị min - ε của vùng tiếp giáp để tạo test case ε là một sai số phù hợp với kiểu dữ liệu của tham số và phù hợp với tham số (tbd).

### Rule BVA-04 [CRITICAL]

- **CẤM** sử dụng các dấu so sánh nghiêm ngặt `<` hoặc `>` khi viết đặc tả dải phân vùng không hợp lệ trong tài liệu High Level (L1) hoặc Mid Level (L2).
- **BẮT BUỘC** chuyển đổi sang dấu so sánh không nghiêm ngặt `<=` hoặc `>=` dựa trên kiểu dữ liệu và sai số của trường thông tin:
  * **Với kiểu số nguyên (int)**: Sai số ε = 1. Ví dụ dải hợp lệ là `30 <= pulse <= 200`. Vùng không hợp lệ thay vì viết `pulse < 30 hoặc pulse > 200` phải chuyển thành `pulse <= 29, pulse >= 201` (ngăn cách bằng dấu phẩy `,`).
  * **Với kiểu số thực (float)**: Sai số ε tùy thuộc vào phần thập phân hiển thị (thường là 0.1). Ví dụ dải hợp lệ là `30.0 <= temp <= 43.0`. Vùng không hợp lệ thay vì viết `temp < 30.0 hoặc temp > 43.0` phải chuyển thành `temp <= 29.9, temp >= 43.1`.

### Rule BVA-05 [NEW]
- **CẤM** sử dụng kiểu điều khiển `select` cho danh sách lựa chọn thả xuống (combobox, selectbox). Bắt buộc phải viết chính xác là `dropdown list`.

### Rule BVA-06 [NEW]
- **CẤM TUYỆT ĐỐI** điền `n/a` hoặc để trống ở cột `Vùng Không Hợp Lệ` cho dropdown list hay bất kỳ điều khiển nào khác trong sheet rules L2.
- **BẮT BUỘC** biểu diễn bằng các toán tử so sánh toán học và logic như `>=`, `<=`, `=`, `!=` (ví dụ: `= Chờ tiêm, Đang tiêm...` cho Vùng Hợp Lệ và `!= Chờ tiêm, Đang tiêm...` cho Vùng Không Hợp Lệ).
- **BẮT BUỘC** sử dụng dấu phẩy `,` ngăn cách thay cho từ "hoặc" tiếng Việt khi có nhiều biên lỗi.


## 4. One-wise Testing

### Định nghĩa

One-wise testing là một kỹ thuật thiết kế test, theo đó, mỗi giá trị đại diện của mỗi tham số đầu vào được chọn để tạo test case.

### Cách áp dụng

Với mỗi giá trị đại diện của mỗi tham số, tạo 1 test case tương ứng.

### Rule OW-01

Với mỗi giá trị đại diện của mỗi tham số, có ít nhất 1 test case tương ứng. 

## 5. Pair-wise Testing (Kiểm thử cặp tham số)

### Định nghĩa

Pair-wise testing là một kỹ thuật thiết kế test, theo đó, mỗi cặp giá trị đại diện của mỗi cặp tham số đầu vào được chọn để tạo test case.

### Cách sử dụng

Với mỗi cặp giá trị của mỗi cặp tham số đầu vào, tạo 1 test case.

### Rule PW-01

Với mỗi cặp giá trị là các giá trị đại diện của các vùng tương đương là tập hợp các giá trị rời rạc của mỗi cặp tham số đầu vào, tạo 1 test case.

### Rule PW-02

Với mỗi cặp giá trị là các giá trị đại diện của các vùng tương đương là tập hợp các giá trị liên tục của mỗi cặp tham số đầu vào, áp dụng Rule OW-01.

### Rule PW-03

SỐ test case được tạo từ PW-01 là tối thiểu.

Số test case khi áp dụng 

Ví dụ: Cho một tính năng với 3 tham số sau đây:

Nhóm tuổi: 3 giá trị: trẻ em, người lớn, người già
Giới tính: Nam, Nữ
Loại Vắc-xin: Pentaxim, BCG

**SAI** ❌ — Full combination (3 × 2 × 2 = 12 TC):

```
Sinh 12 dòng data cho 3 tham số, mỗi tham số 2–3 giá trị
→ Quá nhiều, lãng phí tài nguyên
```

**ĐÚNG** ✅ — Pair-wise (chỉ cần ~6 TC):

```
giới_tính | nhóm_tuổi  | loại_vaccine
---------|-----------|----------------
Nam      | Trẻ em    | Pentaxim
Nam      | Người lớn | BCG
Nữ       | Trẻ em    | BCG
Nữ       | Người lớn | Pentaxim
Nam      | Người già  | Pentaxim
Nữ       | Người già  | BCG
```

> Mọi cặp (giới_tính, nhóm_tuổi), (giới_tính, loại_vaccine), (nhóm_tuổi, loại_vaccine) đều xuất hiện ít nhất 1 lần.

---

## Common Rules

### CR-01

Mọi tham số đầu vào của tính năng đều được đưa vào phân tích khi tạo test case.

### CR-02

Các tham số không liên quan đến tính năng đang được xét, song có thể ảnh hưởng đến tính năng đó, có thể được đưa vào phân tích khi tạo test case.

### CR-03

Mọi business rule, và mọi nhánh logic xử lý đầu vào tương ứng với một kiểu đầu ra phải được đưa vào phân tích khi tạo test case. 

### CR-04

Với mỗi nhánh logic xử lý đầu vào tương ứng với một kiểu đầu ra, áp dụng các kỹ thuật thiết kế test riêng cho mỗi kiểu xử lý đó.

### CR-05

Kiểu dữ liệu của tham số phải được tính đến khi áp dụng các kỹ thuật test (EP, BVA).

### CR-06

Với tham số có dữ liệu kiểu chuỗi, cần phân tích tham số này dưới dạng 2 tham số con:

Nội dung: áp dụng kỹ thuật EP, phân biệt các vùng tương đương
Độ dài: áp dụng kỹ thuật EP và BVA

### CR-07

Với tham số có dữ liệu kiểu chuỗi, cần cover các trường hợp phân biệt/không phân biệt hoa thường (case-sensitive/insensitive), chứa dấu cách khoảng trắng, số, ký tự đặc biệt và ký tự Unicode

### CR-08

Với tham số có dữ liệu kiểu số, cần cover các giá trị trong phạm vi sai số cho phép (Valid) và ngoài sai số (Invalid)

