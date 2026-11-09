# Bản đồ OpenStreetMap – Vận Hành 1.3.5

## Cách mở

1. Thoát hoàn toàn app cũ, giải nén toàn bộ ZIP vào thư mục mới.
2. Mở `VanHanh_Desktop/VanHanh.exe`, giữ MySQL Server đang chạy và dùng cấu hình/CSDL hiện tại.
3. Vào **Bản đồ tuyến**, chọn tuyến và nhấn **Tải bản đồ**. Màn hình phải ghi **Bản đồ 1.3.5**.

Không cần chạy lại SQL hoặc xóa CSDL. Giữ `resources`, `locales` và DLL cạnh EXE; không chỉ chép riêng EXE, không mở app bên trong ZIP.

## Sửa lỗi ở tầng tải ảnh

Các bản trước tải ảnh trong bộ kết nối Chromium của Electron. Mã chẩn đoán lại ưu tiên mã chung trước nội dung lỗi, nên một lỗi có mã ERR_FAILED kèm thông tin chứng chỉ/DNS có thể bị gộp thành NETWORK_ERROR. Ảnh chụp bản 1.3.4 chưa đủ để biết chính xác lỗi thấp hơn trên máy người dùng.

Bản 1.3.5 thay bộ tải ngoài bằng công cụ HTTPS của hệ điều hành. Trên Windows dùng tệp `curl.exe` có sẵn trong `Windows/System32`; vẫn lấy chính ảnh từ `https://tile.openstreetmap.org`, không đổi nguồn bản đồ. Nếu hệ điều hành không có công cụ này, app giữ bộ tải Electron và báo mã lỗi thực tế.

Bộ tải được gọi trực tiếp bằng danh sách tham số, không qua shell. Giữ xác thực chứng chỉ, bỏ qua cấu hình curl cá nhân để bảo đảm tham số của app, không gửi cookie/tài khoản ứng dụng, không truyền biến mật khẩu MySQL cho tiến trình tải. Có giới hạn dung lượng, thời gian chờ và hủy tiến trình khi yêu cầu bị hủy. Thư mục làm việc của tiến trình là thư mục thực của công cụ hệ thống, tránh dùng thư mục ảo app.asar.

App vẫn gộp yêu cầu trùng, giới hạn kết nối, lưu cache theo chỉ dẫn máy chủ và tạm dừng khi máy chủ trả 403/429. Chỉ có OpenStreetMap. SQL, màu sắc/phông chữ và các nghiệp vụ hiện tại được giữ nguyên.

## Nếu vẫn lỗi trên máy bạn

Dòng **Mã kết nối** giờ giữ lỗi thấp hơn, ví dụ `CURL_6`, `CURL_28`, `CURL_60/SEC_E_UNTRUSTED_ROOT`, `ERR_NAME_NOT_RESOLVED` hoặc mã tương ứng. Chụp đầy đủ dòng đó.

Có thêm `KIEM_TRA_BAN_DO.cmd` cạnh EXE để kiểm tra một ảnh OpenStreetMap độc lập với app. Chạy bằng nhấp đúp, không cần quyền quản trị. Công cụ chỉ tải một ảnh thử vào thư mục tạm rồi xóa, không đọc cấu hình MySQL, tài khoản hay mật khẩu. HTTP 200 và CURL_EXIT=0 cho biết Windows tải được ảnh. Nếu cần tiếp tục chẩn đoán, gửi màn hình kết quả này cùng mã lỗi trong app.

Ảnh nền vẫn cần Internet. Một chính sách chặn mạng hoặc lỗi chứng chỉ thực sự của hệ điều hành cần được xác định bằng mã cụ thể, không thể kết luận chỉ từ nền xám. App không tắt TLS hoặc các cơ chế bảo mật để che lỗi.

## Phạm vi bản đồ

Các vị trí có sẵn là vị trí đại diện địa danh, chưa phải bến xe cụ thể. Đường nét đứt nối hai điểm, không phải lộ trình đường bộ. **Mở chỉ đường** mở chỉ đường OpenStreetMap. Độ dài nghiệp vụ vẫn lấy từ `TUYEN_DUONG.DoDai`.

© OpenStreetMap contributors. Chính sách ảnh nền: https://operations.osmfoundation.org/policies/tiles/ . App chỉ tải những ảnh người dùng đang xem, không đóng gói ảnh bản đồ hoặc tải sẵn vùng. Tra cứu địa danh vẫn giới hạn hàng đợi và cache theo https://operations.osmfoundation.org/policies/nominatim/ . Công cụ HTTPS: https://curl.se/docs/manpage.html .

Mã nguồn đầy đủ trong `ma-nguon`; xem `KIEM_THU_BAN_DO.md` để biết kiểm thử thực tế và giới hạn xác minh.
