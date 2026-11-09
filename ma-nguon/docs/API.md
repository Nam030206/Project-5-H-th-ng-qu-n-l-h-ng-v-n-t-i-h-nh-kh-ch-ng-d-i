# API

Mọi endpoint dưới `/api`. Request và response JSON, trừ nhập/xuất tệp. Frontend gọi cùng origin; Vite chuyển tiếp `/api` tới backend khi phát triển.

Sau đăng nhập: cookie HttpOnly lưu phiên. Response có `csrfToken`; mọi request ghi gửi header `X-CSRF-Token`. `GET /auth/me` trả thông tin tài khoản và CSRF token tương ứng phiên hiện tại.

## Xác thực

| Method | URL              | Dữ liệu / tác dụng                                                                                                                               |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/auth/status`   | Hệ thống đã có tài khoản đầu tiên chưa                                                                                                           |
| POST   | `/auth/setup`    | `{setupToken, account:{TenDangNhap,HoTen,MatKhau}}`; chỉ khi chưa có tài khoản                                                                   |
| POST   | `/auth/register` | Công khai sau thiết lập: `{TenDangNhap,HoTen,MatKhau,XacNhanMatKhau}` → `201 {message,user}`; luôn tạo `passenger` hoạt động, không tự đăng nhập |
| POST   | `/auth/login`    | `{username,password}`                                                                                                                            |
| GET    | `/auth/me`       | Tài khoản hiện tại + CSRF token                                                                                                                  |
| POST   | `/auth/logout`   | Thu hồi phiên và xóa cookie                                                                                                                      |
| GET    | `/health`        | Tình trạng kết nối MySQL                                                                                                                         |

## Nghiệp vụ

`entity` chỉ nhận `buses`, `drivers`, `routes`, `trips`; bảng và khóa tương ứng được ánh xạ từ danh sách cho phép.

| Method | URL                        | Tác dụng                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------ |
| GET    | `/entities/:entity`        | `{rows,total,page,limit}`; phân trang `page`, `limit` từ 1–100, tìm `q`  |
| GET    | `/entities/:entity/:id`    | `{record,history}`; lịch sử tối đa 2.000 chuyến gần nhất                 |
| POST   | `/entities/:entity`        | Thêm bản ghi với các cột nhập được của entity                            |
| PUT    | `/entities/:entity/:id`    | Thay thông tin; giữ nguyên khóa chính                                    |
| DELETE | `/entities/:entity/:id`    | Xóa sau kiểm tra quyền và tham chiếu                                     |
| POST   | `/entities/:entity/import` | Multipart `file` CSV/XLSX; nhập nguyên tử                                |
| GET    | `/entities/:entity/export` | Excel mặc định, `format=csv` cho CSV; giữ bộ lọc                         |
| GET    | `/options`                 | Xe/tài xế/tuyến cho dropdown và đồng hồ MySQL                            |
| GET    | `/schedule`                | Chuyến theo `start`, `end`, `BienSo`, `MaTuyen`; tối đa 10.000 dòng      |
| POST   | `/maintenance/:id`         | `{date:"YYYY-MM-DD"}`; ghi nhận mốc bảo dưỡng đã thực hiện               |
| GET    | `/dashboard`               | Metrics, doanh thu 7 ngày, chuyến từ hôm nay, bảo dưỡng và tuyến nổi bật |
| GET    | `/maps/:id`                | Vị trí hai đầu tuyến từ Nominatim, có cache và giới hạn tần suất         |

Bộ lọc bổ sung: xe có `HangSanXuat`, `MauXe`; tài xế có `LoaiBangLai`; tuyến có `DoPhucTap`; chuyến có `BienSo`, `MaTuyen`, `start`, `end`. Tìm kiếm chuyến bao gồm mã, biển số, tuyến và tên lái chính/phụ xe.

Các cột dẫn xuất không nhập trực tiếp. Nội dung POST/PUT được kiểm tra strict schema; không cho chỉ định tên bảng hay câu SQL tùy ý.

## Báo cáo

`GET /reports/:type` → `{rows,clock,start,end}`. `GET /reports/:type/export` xuất Excel/CSV.

| `type`        | Nội dung                                               | Tham số                    |
| ------------- | ------------------------------------------------------ | -------------------------- |
| `salary`      | Lương và số chuyến mỗi vai trò trong tháng hiện tại    | Không dùng khoảng tùy ý    |
| `revenue`     | Doanh thu từng xe, giữ xe doanh thu 0, có hai cột ngày | `start`, `end`             |
| `maintenance` | Km làm việc, hạn, ngày còn lại, trạng thái             | Theo ngày hiện tại         |
| `records`     | Số dòng bốn bảng + tổng                                | Không đếm bảng hỗ trợ/view |
| `passengers`  | Lượng khách từng tuyến                                 | `start`, `end`             |
| `occupancy`   | Tỷ lệ số khách / số chỗ quy định từng chuyến           | `start`, `end`             |
| `inactive`    | Xe không có chuyến đã thực hiện gần đây                | `days` từ 1–3650           |

## Quản trị

| Method | URL                | Tác dụng                                                       |
| ------ | ------------------ | -------------------------------------------------------------- |
| GET    | `/accounts`        | Danh sách tài khoản; `q`, `page`, `limit`                      |
| POST   | `/accounts`        | Tạo tài khoản; `TenDangNhap,HoTen,MatKhau,VaiTro,HoatDong`     |
| PUT    | `/accounts/:id`    | Sửa tài khoản; `MatKhau` không bắt buộc                        |
| GET    | `/audit`           | Nhật ký; `q`, `page`, `limit`; JSON trước/sau đã loại mật khẩu |
| POST   | `/backups/export`  | `{password}` → JSON sao lưu bốn bảng nghiệp vụ                 |
| POST   | `/backups/preview` | Multipart `file` → thời điểm + số dòng từng bảng               |
| POST   | `/backups/restore` | Multipart `file,password,confirmation=PHUC HOI`                |

## Quyền

- Passenger: chỉ truy cập cổng hành khách và các đăng ký của chính tài khoản; bị chặn mọi endpoint nội bộ, kể cả đọc và xuất tệp.
- Operator: thêm/sửa/nhập nghiệp vụ, ghi bảo dưỡng; chỉ sửa hoặc xóa chuyến có ngày sau hôm nay; không xóa bảng cha.
- Admin: toàn bộ; có thể đính chính lịch sử. Tài khoản, nhật ký, sao lưu/phục hồi chỉ dành cho admin.

## Mã lỗi

`401` chưa đăng nhập/hết phiên; `403` sai quyền, CSRF hoặc mật khẩu xác nhận; `404` không có bản ghi; `409` trùng mã, tham chiếu đang dùng hoặc xung đột cập nhật; `413` tệp quá 5 MB; `422` sai dữ liệu/ràng buộc; `429` đăng nhập hoặc đăng ký quá nhiều lần; `503` CSDL/dịch vụ ngoài chưa sẵn sàng.

Lỗi trả `{message,details?}`. Chi tiết form có `{field,message}`; nhập tệp có `{row,message}`. Không trả stack trace hoặc thông tin kết nối MySQL cho giao diện.

## Tự đăng ký

`POST /api/auth/register` không cần phiên đăng nhập hoặc mã thiết lập. Chỉ nhận bốn trường được nêu trên, kiểm tra mật khẩu xác nhận và giới hạn mật khẩu 72 byte UTF-8. Gửi `VaiTro`, `HoatDong` hoặc trường lạ bị từ chối (`422`). Tên đăng nhập được trim, phải gồm 3–50 chữ ASCII, số hoặc `_ . -`; ràng buộc UNIQUE trong MySQL xử lý cả trùng tên đồng thời. Trùng tên trả `409`. Trước khi có quản trị viên hoạt động, đăng ký trả `409`, giữ luồng thiết lập đầu tiên.

Giới hạn đăng ký riêng: 10 yêu cầu/IP/15 phút, tính cả thành công và lỗi; lần tiếp theo trả `429`. `originGuard` vẫn áp dụng. Giao dịch lưu tài khoản và nhật ký `REGISTER` cùng lúc; không lưu mật khẩu xác nhận hoặc mật khẩu rõ. Thành công không tạo cookie phiên: người dùng đăng nhập bằng endpoint hiện có. Quản trị viên có thể đổi quyền/khóa tài khoản như trước; thao tác này thu hồi các phiên cũ.

## Cổng hành khách và đăng ký chuyến (1.3.0)

| Method | URL                              | Quyền và tác dụng                                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/passenger/meta`                | Passenger: đồng hồ MySQL; không trả dropdown nhân sự                           |
| GET    | `/passenger/trips`               | Passenger: chuyến có ngày đi sau hôm nay; `q,start,end,available=1,page,limit` |
| POST   | `/passenger/bookings`            | Passenger: strict `{MaSoChuyenXe,SoLuong,GiaVe}`; `201` xác nhận giữ chỗ       |
| GET    | `/passenger/bookings`            | Passenger: chỉ đăng ký của chính mình; `q,status,page,limit`                   |
| POST   | `/passenger/bookings/:id/cancel` | Passenger: hủy của chính mình trước ngày đi; `{LyDoHuy?}`                      |
| GET    | `/bookings`                      | Admin/operator: người đăng ký, hành trình, số chỗ; `q,status,page,limit`       |
| POST   | `/bookings/:id/cancel`           | Admin/operator: hỗ trợ hủy trước ngày đi; `{LyDoHuy?}`                         |

`status` nhận `confirmed` hoặc `cancelled`. `CoTheHuy` trong kết quả là boolean. Đăng ký lưu giá vé lúc xác nhận, số chỗ và ảnh chụp thông tin chuyến; `ThanhTien` là chuỗi số nguyên giữ chính xác tiền đồng. Chưa có thanh toán trực tuyến.

Máy chủ lấy chủ đăng ký từ phiên, không nhận `TaiKhoanId` từ biểu mẫu. Gửi thêm trường lạ bị từ chối. Trùng đăng ký đang hiệu lực, hết chỗ, đổi giá hoặc chuyến đã đến ngày đi trả `409`; không tìm thấy đăng ký của chính mình trả `404`. Hủy lặp lại trả `200` mà không trừ chỗ hai lần. Có thể đăng ký lại sau khi hủy nếu vẫn trước ngày đi và còn chỗ.

Mỗi lần đăng ký/hủy dùng giao dịch, khóa phối hợp theo CSDL và khóa dòng; cập nhật `SoKhach`, đăng ký và nhật ký cùng lúc. `SoKhach` là tổng khách của chuyến, gồm khách nhà xe nhập và chỗ đăng ký qua app. Hai trigger bổ sung không cho giảm tổng khách dưới chỗ đã đăng ký hoặc thay tuyến/xe/ngày/giá của chuyến đã có đăng ký; đầu cuối tuyến có đăng ký cũng được bảo vệ. Khi nhà xe xóa/hủy chuyến, các đăng ký được hủy kèm lý do và giữ lịch sử.

Phục hồi bốn bảng nghiệp vụ kiểm tra các đăng ký tương lai đang hiệu lực. Bản sao làm mất chuyến, đổi hành trình/giá/ngày hoặc chứa số khách thấp hơn số chỗ đã đăng ký bị từ chối; bản tương thích giữ và nối lại các đăng ký hiện tại trong cùng giao dịch.
