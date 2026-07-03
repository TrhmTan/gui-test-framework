# Hướng dẫn Data Động (`$env_data`) — Dành cho QC

## TL;DR — Chỉ cần biết 1 điều

> Khi muốn thêm/sửa khách hàng, phòng khám, vắc xin... → **chỉ mở 1 file này**:
> 
> `config/env_data/Tiem_Chung/shared.json`

---

## Cú pháp dùng trong Excel (cột `value`)

```
$env_data.{tên_key}[INDEX:số hoặc RANDOM]
```

Nếu key chứa danh sách "Tên — Mã — SĐT", thêm phần `:name`, `:pid`, hoặc `:phone` để lấy từng phần:

```
$env_data.{tên_key}[INDEX:số]:name
$env_data.{tên_key}[INDEX:số]:pid
$env_data.{tên_key}[INDEX:số]:phone
```

---

## Ví dụ thực tế

| Viết trong cột `value` | Kết quả khi chạy |
|---|---|
| `$env_data.ddl_customer[INDEX:1]:name` | `Hồ Gia Bảo` |
| `$env_data.ddl_customer[INDEX:1]:pid` | `PT-0010` |
| `$env_data.ddl_customer[INDEX:1]:phone` | `0900000010` |
| `$env_data.ddl_customer[RANDOM]:name` | Tên bất kỳ trong danh sách |
| `$env_data.ddl_room_select[INDEX:1]` | `Phòng khám sàng lọc 101` |
| `$env_data.ddl_vaccine_select[INDEX:2]` | `Gardasil 9` |

---

## Các key hiện có trong `shared.json`

| Key | Dùng ở đâu |
|---|---|
| `ddl_customer` | Mọi màn hình (tra cứu, tiếp đón, khám sàng lọc, tiêm) |
| `ddl_room_select` | Phòng khám sàng lọc (9.1.1, 9.1.2) |
| `ddl_room_vaccination` | Phòng tiêm (9.2.1) |
| `ddl_vaccine_select` | Loại vắc xin (9.1.3) |
| `ddl_dose_select` | Liều mũi tiêm |
| `ddl_appointment_type` | Loại cuộc hẹn (vãng lai / có hẹn) |
| `ddl_doctor` | Bác sĩ khám |
| `ddl_injection_site` | Vị trí tiêm (9.2.2) |

---

## Khi nào dùng `parameterized = N` vs `Y`?

| | `parameterized = N` | `parameterized = Y` |
|---|---|---|
| **Khi nào** | Test case đơn giản, dùng 1 bộ data cố định | Muốn lặp test với nhiều bộ data khác nhau |
| **Cách điền** | Điền thẳng `$env_data.*` vào cột `value` | Tạo dòng trong sheet `DATA_*`, dùng `$data_*.column_name` trong `value` |
| **Fresher dùng** | ✅ Cách này trước | Nâng cao hơn, dùng sau khi quen |

---

## Quy trình khi phải thêm khách hàng test mới

1. Mở `config/env_data/Tiem_Chung/shared.json`
2. Tìm key `"ddl_customer"` trong block `"TEST": { ... }`
3. Thêm 1 dòng theo format: `"Họ Tên — MãBN — SĐT"`
4. Lưu file → chạy test lại

> ✅ Không cần sửa bất kỳ file Excel hay code nào khác!
