# Kiểm thử 1.3.5

- 41/41 bài kiểm thử đạt; build giao diện thành công. Sau khi cố định thư mục làm việc của công cụ hệ thống, chạy lại 4 kiểm thử của bộ tải: đều đạt.
- Các kiểm thử mới bao phủ phản hồi nhị phân, 304, 403/429, hủy tiến trình, giới hạn dữ liệu, loại bỏ biến mật khẩu khỏi môi trường tiến trình tải và giữ mã chứng chỉ/DNS khi lỗi ngoài có mã chung.
- Chạy Electron 45.2.3 thực, từ utilityProcess gọi bộ tải HTTPS đã chọn: tải ảnh PNG thật từ OpenStreetMap, HTTP 200. Trước đó bộ tải Chromium gặp lỗi kết nối/chứng chỉ trong môi trường thử; bộ tải hệ điều hành sử dụng CA/proxy được cấp và giữ xác thực TLS.
- Chạy cả giao diện Electron và tiến trình dữ liệu với chính module/asset trong resources/app.asar của bộ đóng gói. Chỉ thay tầng MySQL bằng dữ liệu thử, không dùng CSDL người dùng, không thay ảnh hoặc giả lập API ảnh.
- Ở viewport 1440×1080, khung bản đồ rộng 1114px, cao 440px: 10/10 ảnh OpenStreetMap thật tải đầy đủ, tất cả HTTP 200; có 2 marker, không có cảnh báo ảnh nền. Dùng chế độ headless và mô phỏng viewport để kiểm tra đúng kích thước; phép thử ở khung 1px không được coi là đạt.
- Kiểm thử chạy trên Linux với Electron thực và công cụ HTTPS của hệ điều hành. Chưa chạy trực tiếp EXE trên Windows hoặc kiểm tra mạng/chứng chỉ của máy người dùng. Vì vậy đây không phải cam kết mọi cấu hình mạng Windows đều hoạt động.
- Đã tạo bộ Windows x64 1.3.5, đối chiếu module mới và asset trong app.asar, cập nhật tài nguyên kiểm tra toàn vẹn của EXE. Hai tệp SQL giữ nguyên từng byte so với bản người dùng gửi. Các cờ chạy headless trong chương trình kiểm thử không được đưa vào app.
