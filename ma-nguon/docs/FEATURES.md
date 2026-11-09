# Đối chiếu chức năng

## Truy vấn bắt buộc của yêu cầu 2

| Yêu cầu                                                  | Màn hình                        | Mã chính                                                  |
| -------------------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| Tên tài xế, lương tháng hiện tại, vai trò và độ phức tạp | Báo cáo → Lương tài xế          | `report-service.js`, `Reports.jsx`, procedure/trigger gốc |
| Doanh thu từng xe giữa ngày bắt đầu/kết thúc             | Báo cáo → Doanh thu theo xe     | `report-service.js`, `Reports.jsx`                        |
| Ngày bảo dưỡng tiếp theo, danh sách quá hạn riêng        | Bảo dưỡng → Tất cả xe / Quá hạn | `Maintenance.jsx`, `report-service.js`, `V_BAO_DUONG`     |
| Số bản ghi của từng bảng và tổng CSDL nghiệp vụ          | Báo cáo → Số bản ghi            | `report-service.js`; chỉ đếm bốn bảng nghiệp vụ           |

## 24 tính năng bổ sung

| STT | Tính năng                     | Cách sử dụng / module                                                                                |
| --: | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
|   1 | Quản lý xe khách              | Xe khách: thêm/sửa/xóa/chi tiết; `EntityPage`, `EntityForm`                                          |
|   2 | Quản lý tài xế                | Tài xế: thêm/sửa/xóa/chi tiết                                                                        |
|   3 | Quản lý tuyến đường           | Tuyến đường: thêm/sửa/xóa; chọn cấp 1–3                                                              |
|   4 | Lập chuyến và phân công       | Chuyến xe: chọn xe/tuyến/lái chính/phụ xe/ngày/khách/giá                                             |
|   5 | Điều chỉnh/hủy chuyến dự kiến | Nhân viên sửa/xóa chuyến sau hôm nay; quản trị được đính chính lịch sử                               |
|   6 | Tìm kiếm, lọc                 | Các bảng có tìm nhanh, bộ lọc phù hợp và phân trang                                                  |
|   7 | Chi tiết chuyến xe            | Nút mắt; hiển thị đầy đủ thuộc tính; hỗ trợ in                                                       |
|   8 | Lịch ngày/tuần                | Lịch trình: chọn ngày bắt đầu, tuần trước/sau, xe, từ khóa                                           |
|   9 | Lịch sử xe                    | Chi tiết xe → bảng chuyến liên quan, tối đa 2.000 chuyến gần nhất                                    |
|  10 | Lịch sử tài xế                | Chi tiết tài xế → chuyến và vai trò từng chuyến                                                      |
|  11 | Gợi ý xe phù hợp              | Khi nhập số khách, xe không đủ chỗ bị vô hiệu hóa trong danh sách chọn                               |
|  12 | Kiểm tra dữ liệu              | Kiểm tra form, Zod và ràng buộc SQL; báo lỗi cụ thể, không lưu nửa chừng                             |
|  13 | Ghi nhận bảo dưỡng            | Nút cờ lê / Đã bảo dưỡng → chọn ngày thực tế và tính lại hạn                                         |
|  14 | Nhập Excel/CSV                | Nhập dữ liệu: tải mẫu, chọn tệp, kiểm tra + nhập nguyên tử                                           |
|  15 | Xuất Excel/CSV/PDF            | Nút xuất ở bảng/báo cáo; in/Save as PDF bằng trình duyệt                                             |
|  16 | Sao lưu/phục hồi              | Sao lưu & phục hồi: mật khẩu, xem trước, nhập PHUC HOI; bốn bảng nghiệp vụ                           |
|  17 | Nhân bản chuyến               | Nút sao chép: mã/ngày mới, giữ tuyến/xe/nhân sự, số khách đặt lại 0                                  |
|  18 | Khách theo tuyến              | Phân tích → Khách theo tuyến: biểu đồ + bảng, chọn kỳ                                                |
|  19 | Tỷ lệ sử dụng chỗ             | Phân tích → Tỷ lệ sử dụng chỗ; tránh chia 0                                                          |
|  20 | Xe lâu không hoạt động        | Phân tích → Xe ít hoạt động: chọn ngưỡng ngày; có xe chưa từng chạy                                  |
|  21 | Đăng ký/đăng nhập/phân quyền  | Tự đăng ký từ màn hình đăng nhập, mặc định Hành khách; cổng hành khách tách biệt; API kiểm tra quyền |
|  22 | Nhật ký                       | Nhật ký thao tác: người, thời điểm, trước/sau; không ghi mật khẩu/hash                               |
|  23 | QR                            | Tạo/tải PNG trong chuyến; tra bằng camera, ảnh hoặc nhập mã                                          |
|  24 | Bản đồ tuyến                  | Chọn tuyến → tải vị trí hai đầu → mở chỉ đường; cần Internet                                         |

Các màn hình dùng chung UI tại `client/src/components`. Backend tách controller, service và DAO; bốn bảng nghiệp vụ vẫn đúng cấu trúc SQL đã thống nhất.

## Chức năng Hành khách bổ sung (1.3.0)

- Tìm chuyến tương lai theo tuyến, mã chuyến, khoảng ngày và chỗ trống.
- Đăng ký một hoặc nhiều chỗ; kiểm tra lại giá vé, sức chứa và đăng ký trùng khi xác nhận.
- Xem xác nhận và hủy đăng ký của chính mình trước ngày đi; trả lại số chỗ chính xác.
- Nhà xe tra cứu người đăng ký, số chỗ, trạng thái và hỗ trợ hủy. Hủy chuyến sẽ hủy các đăng ký liên quan, giữ lại lịch sử.
- Ba vai trò: admin/operator/passenger. Nâng cấp Người xem cũ thành Hành khách, giữ mật khẩu, thu hồi phiên cũ.
