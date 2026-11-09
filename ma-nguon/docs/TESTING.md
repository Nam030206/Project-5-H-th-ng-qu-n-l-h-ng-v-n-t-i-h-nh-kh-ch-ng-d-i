# Kiểm tra bản sửa khởi động 1.3.1

- 19 kiểm thử đơn vị đã qua, gồm 7 kiểm thử mới cho tải tài nguyên khởi động và luồng main.
- Kiểm tra đủ HTML/CSS/JS/SVG và MIME trong gói, đường dẫn có dấu/khoảng trắng/#/%, danh sách tệp cho phép, chặn truy cập tệp tùy ý, phân biệt quyền điều hướng và IPC.
- Hai kiểm thử thực thi module main với mô phỏng Electron xác nhận tới màn hình cấu hình khi trang chờ bình thường hoặc cố tình báo ERR_FAILED; giữ sandbox, context isolation, webSecurity và không kết nối MySQL trước cấu hình. Đây là kiểm thử luồng code, không phải nghiệm thu GUI Windows.
- Đã kiểm tra tài nguyên khởi động bên trong app.asar của gói Windows và PE x64.
- Backend, schema và React không đổi so với 1.3.0; 45 kết quả tích hợp MySQL và 6 luồng renderer bên dưới là kết quả của bản 1.3.0, không chạy lại trong bản sửa desktop này.
- Chưa nghiệm thu cửa sổ Electron trên máy Windows thực. Cần xác nhận bằng cách giải nén đầy đủ gói mới, mở VanHanh.exe và kiểm tra màn hình kết nối.

## Kiểm thử chức năng kế thừa từ 1.3.0


## Đã kiểm tra

- Build production giao diện React/Tailwind và kiểm tra cú pháp các entry desktop.
- 12 unit test: 7 kiểm tra dữ liệu/công thức/parser/tệp và 5 kiểm tra cấu hình desktop, deep link, origin, liên kết ngoài, lưu cấu hình không ghi plaintext mật khẩu.
- 42 nhóm integration test trên MySQL 8.0.46, tương ứng 45 kết quả gồm ba test cha: xác thực, CSRF, phân quyền, báo cáo, CRUD/ràng buộc, lương, lịch, bảo dưỡng, CSV/Excel, hoàn tác nhập, sao lưu/phục hồi, nhật ký, thu hồi phiên và khởi tạo lại giữ dữ liệu.
- 10 nhóm kiểm thử đăng ký bổ sung: không vượt luồng thiết lập, dữ liệu không hợp lệ, xác nhận mật khẩu/UTF-8, chống tự cấp quyền, hash và đăng nhập, trùng tên/đồng thời, nguồn yêu cầu, giới hạn đăng ký, nâng quyền/khóa tài khoản và nhật ký không lộ mật khẩu.
- 6 luồng giao diện Hành khách được kiểm tra với bản build production và MySQL thật trên Chromium headless Linux: tự đăng ký/đăng nhập đúng cổng, giữ nhiều chỗ, xem/hủy xác nhận, chặn màn hình nội bộ, giao diện sáng/tối ở 1440×1000 và 900×640, quản trị xem đăng ký và bộ chọn vai trò chỉ có Quản trị viên/Nhân viên/Hành khách. Ảnh render được xem để kiểm tra bố cục. Kiểm tra renderer không thay thế nghiệm thu Electron trên Windows.
- 12 nhóm kiểm thử Hành khách: nâng cấp schema cũ và mật khẩu/phiên; API riêng tư; danh sách trường công khai; cộng/trả chỗ; đăng ký trùng/giả chủ/CSRF/giá cũ; hủy lặp và đăng ký lại; tranh chỗ cuối; trigger bảo vệ dữ liệu; nhà xe hủy chuyến; hoàn tác khi nhật ký lỗi; phục hồi tương thích; nâng cấp lặp giữ dữ liệu.
- Nhóm integration desktop chạy chính module `backend-service.cjs` với adapter IPC Node dành cho test: khởi động ở cổng loopback tự chọn, kiểm tra API thật với MySQL, chặn truy cập chưa đăng nhập và dừng sạch bằng thông điệp shutdown. Adapter không được đưa vào app đóng gói.
- Đóng gói portable Windows x64 và kiểm tra các tệp bắt buộc trong app.asar. Không nhúng `.env`, bộ test hoặc dữ liệu kết nối cá nhân vào bản chạy.

## Chưa xác minh trên thiết bị thật

Chưa chạy nghiệm thu cửa sổ Electron trên Windows thực. Unit test IPC/policy và integration service không thay thế kiểm tra giao diện native. Cũng chưa kiểm tra bằng camera phần cứng, máy in hoặc toàn bộ luồng kết nối bản đồ ngoài. Bản giao phục vụ đồ án chưa ký số.

## Nghiệm thu trên máy Windows

1. Bật MySQL Server, mở VanHanh.exe, nhập thông tin kết nối.
2. Kiểm tra kết nối, chọn khởi tạo/nâng cấp và mở app; xác nhận dữ liệu cũ được giữ lại.
3. Tạo quản trị viên nếu hệ thống trống. Đăng xuất → Đăng ký → tạo tài khoản mới → đăng nhập. Thử trùng tên và xác nhận mật khẩu sai; kiểm tra tài khoản mới là Hành khách. Nhà xe tạo chuyến có ngày đi từ ngày mai, hành khách đăng ký/hủy và kiểm tra số chỗ thay đổi. Sau đó đăng nhập quản trị để xem Đăng ký hành khách và thử cấp thêm quyền. Mở từng màn hình quản lý, bảng và dialog.
4. Thêm/sửa/xóa một dữ liệu thử; kiểm tra sức chứa và hai vai trò khác nhau.
5. Kiểm tra bốn nhóm báo cáo, khoảng ngày doanh thu, lương và bảo dưỡng.
6. Thử nhập Excel/CSV, xuất dữ liệu, hộp thoại lưu tệp, in và menu Lưu PDF.
7. Dùng CSDL thử cho sao lưu/phục hồi; xác nhận tài khoản và nhật ký giữ nguyên.
8. Kiểm tra phân quyền bằng nhân viên/hành khách; dùng lại mật khẩu MySQL khi đổi kết nối chỉ dành cho quản trị đang đăng nhập, hoặc nhập lại mật khẩu.
9. Thử QR bằng ảnh/camera; mở liên kết vanhanh:// sau khi app đã đăng ký giao thức.
10. Đóng app và mở lại, kiểm tra cấu hình được nhớ và backend tự khởi động; di chuyển tệp portable thì mở app lại để cập nhật liên kết giao thức.

Không chạy integration test vào CSDL làm bài: bộ test xóa/khởi tạo lại CSDL thử và chỉ nhận tên bắt đầu VanHanhTest.

## Chạy kiểm thử bổ sung

`npm run test:integration` chạy cả ba bộ kiểm thử, tuần tự để không xung đột CSDL thử. `server/tests/fixtures/app-v1.sql` chỉ phục vụ mô phỏng schema Người xem trước khi nâng cấp; không phải schema sử dụng của bản hiện tại. Không chạy kiểm thử vào CSDL làm bài.
