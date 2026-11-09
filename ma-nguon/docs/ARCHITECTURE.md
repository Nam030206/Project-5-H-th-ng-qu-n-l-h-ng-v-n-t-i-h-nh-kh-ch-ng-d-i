# Thiết kế và ranh giới dữ liệu

## Luồng xử lý

React page → `lib/api.js` → Express Controller → Service → DAO → mysql2 → MySQL. Kết nối MySQL chỉ nằm ở backend; không nhúng mật khẩu vào React hoặc gửi câu SQL từ trình duyệt.

DAO dùng tên bảng/cột từ danh sách cho phép và dùng tham số cho dữ liệu. Service kiểm tra kiểu, tính hợp lệ, quyền và giao dịch. Controller chuyển request/response. Middleware bắt lỗi SQL, lỗi xác thực, giới hạn tệp và trả thông báo tiếng Việt.

## CSDL

`01_project5.sql` là bản SQL phiên bản 3 trong cuộc trao đổi, bao gồm bốn bảng nghiệp vụ, hai view, 10 trigger, các thủ tục cập nhật và dữ liệu mẫu có điều kiện. Nó được giữ nguyên trong dự án.

`02_app.sql` bổ sung:

- `APP_TAI_KHOAN`: tên đăng nhập, họ tên, hash mật khẩu, vai trò, trạng thái, thời điểm tạo.
- `APP_PHIEN_DANG_NHAP`: hash token, tài khoản, hash CSRF và thời điểm hết hạn. Đây là bảng kỹ thuật lưu phiên để không phụ thuộc bộ nhớ server.
- `APP_NHAT_KY`: người thao tác, hành động, bảng/mã, JSON trước/sau và thời điểm.

- `APP_DANG_KY_CHUYEN`: tài khoản, chuyến, số chỗ, giá vé xác nhận, trạng thái, thời điểm đăng ký/hủy, lý do hủy và JSON thông tin chuyến. Khóa duy nhất theo tài khoản/chuyến; FK chuyến cho SET NULL khi nhà xe xóa chuyến, lịch sử dùng JSON đã lưu.

Bốn bảng APP phục vụ đăng nhập, nhật ký và đăng ký chỗ. Báo cáo số bản ghi theo đề và sao lưu nghiệp vụ chỉ xét bốn bảng gốc, tránh cộng nhầm dữ liệu hỗ trợ.

## Cập nhật và tính nhất quán

Trigger gốc duy trì giá trị dẫn xuất khi dữ liệu đổi. Refresh service gọi hai procedure trong một giao dịch khi cần làm mới theo lịch; cùng một tác vụ không chạy chồng nhau. Đồng hồ được kiểm tra ở múi giờ Việt Nam để cập nhật khi sang ngày mới.

Các thay đổi nghiệp vụ và nhật ký của thay đổi đó được ghi trong cùng giao dịch. Nhập tệp và phục hồi hoàn tác toàn bộ nếu lỗi. Các giao dịch ghi nghiệp vụ sử dụng advisory lock theo tên CSDL, giúp tuần tự hóa thay đổi giữa nhiều request của ứng dụng. Việc sửa trực tiếp bằng công cụ ngoài app không thuộc khóa phối hợp này; ràng buộc MySQL vẫn áp dụng.

## Xác thực và quyền

- Mật khẩu hash bcrypt, hệ số 12; không đưa mật khẩu vào nhật ký hoặc kết quả API.
- Token phiên ngẫu nhiên 256 bit; DB chỉ giữ SHA-256; cookie HttpOnly, SameSite Strict; thời hạn 12 giờ.
- Các API ghi đã đăng nhập yêu cầu CSRF token; nguồn gửi request được kiểm tra. Chặn dò đăng nhập bằng rate limit.
- Không có tài khoản mặc định. Thiết lập đầu tiên yêu cầu mã cấu hình hoặc mã ngẫu nhiên in trong terminal, và chỉ tạo được khi chưa có tài khoản.
- Tự đăng ký công khai qua `/api/auth/register` sau thiết lập ban đầu; schema strict chỉ nhận thông tin tài khoản và xác nhận mật khẩu. Máy chủ luôn gán `passenger`, ghi nhật ký trong cùng giao dịch, giới hạn riêng 10 yêu cầu/IP/15 phút. Không tự tạo phiên sau đăng ký.
- Vai trò lấy lại từ DB trên mỗi request; khóa tài khoản, đổi mật khẩu/quyền sẽ thu hồi phiên. Không cho quản trị viên tự khóa hoặc tự hạ quyền đang sử dụng.
- Backend từ chối thao tác ngoài quyền dù người dùng tự gọi API. Không chỉ ẩn nút phía React.

## Các giới hạn thiết kế được nêu rõ

- Lịch theo ngày, vì thiết kế gốc chưa có giờ hoặc trạng thái chuyến. App không suy ra xung đột giờ hay thêm quy tắc một chuyến/ngày.
- Vì chưa có trạng thái hoàn tất, báo cáo coi bản ghi có ngày thực hiện đến hôm nay là chuyến đã thực hiện. Chuyến dự kiến không chạy cần được hủy/đính chính để không đi vào số liệu báo cáo.
- “Hủy chuyến” là xóa chuyến dự kiến có xác nhận và nhật ký; chưa thêm cột trạng thái vào bảng gốc.
- Ghi nhận bảo dưỡng cập nhật mốc gần nhất. Bản gốc chưa có bảng từng lần bảo dưỡng; thao tác được lưu trong nhật ký.
- Lương tính theo hệ số tuyến đang lưu, đúng SQL ban đầu. Nếu sau này muốn giữ đơn giá/hệ số lịch sử, cần thiết kế thêm phiên bản hoặc lưu đơn giá tại chuyến.
- Tỷ lệ sử dụng chỗ dùng số ghế xe hiện tại; mẫu chưa có lịch sử đổi cấu hình ghế.
- QR không công khai hồ sơ: mở chuyến vẫn cần đăng nhập. Quét ảnh thực hiện trên thiết bị.
- Map chỉ tìm vị trí hai đầu và hiển thị đường nối minh họa; không lấy khoảng cách đường thẳng thay cho độ dài tuyến nghiệp vụ.
- Bản sao lưu có checksum phát hiện thay đổi, không phải chữ ký xác minh nguồn. Quyền phục hồi vẫn yêu cầu quản trị viên, CSRF và mật khẩu.
- App không cung cấp truy vấn SQL tự do hay phục hồi SQL do người dùng tải lên. Tệp phục hồi được kiểm tra schema, khóa, tham chiếu và sức chứa trước khi áp dụng.

## Tài liệu kỹ thuật tham khảo

- React: https://react.dev/learn/build-a-react-app-from-scratch
- Tailwind/Vite: https://tailwindcss.com/docs/installation/using-vite
- mysql2 prepared statements: https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements
- Express 5 error handling: https://expressjs.com/en/5x/guide/error-handling/
- OpenStreetMap/Nominatim: https://operations.osmfoundation.org/policies/nominatim/

## Lớp desktop Electron

`desktop/main.mjs` tạo cửa sổ riêng, giữ IPC theo origin và main frame, khởi động `backend-service.cjs` qua utilityProcess. Backend nghe loopback ở cổng hệ điều hành cấp; không dùng cổng cố định hay yêu cầu người dùng tự mở trình duyệt. Đóng app gửi shutdown, đóng pool và dừng tiến trình con.

Preload chỉ lộ các hàm cấu hình, in/PDF và bootstrap cần thiết; renderer không có Node integration, có context isolation và sandbox. Chỉ đường dẫn ứng dụng và màn hình cấu hình được điều hướng bên trong; liên kết OpenStreetMap được mở bằng chương trình ngoài.

Kết nối MySQL được lưu trong userData; mật khẩu qua safeStorage khi kho khóa khả dụng, không ghi plaintext dự phòng. Khi thay kết nối, chỉ quản trị viên đã đăng nhập được dùng lại mật khẩu đang nhớ; các trường hợp khác nhập lại mật khẩu MySQL. Không gửi mật khẩu đã nhớ sang host/tài khoản khác.

Deep link dùng đường dẫn tệp portable gốc qua PORTABLE_EXECUTABLE_FILE thay vì đường dẫn tạm đã giải nén. Frontend React nhận token thiết lập lần đầu qua preload đã giới hạn, không buộc người dùng đọc mã terminal.

Tham khảo: https://www.electronjs.org/docs/latest/tutorial/security ; https://www.electronjs.org/docs/latest/api/utility-process ; https://www.electronjs.org/docs/latest/api/safe-storage ; https://www.electron.build/v26/docs/nsis/

## Nâng cấp vai trò và giữ chỗ

`app-schema-service.js` chạy trước khi desktop backend mở cổng. Nó kiểm tra schema, khóa nâng cấp/phối hợp nghiệp vụ và áp dụng `02_app.sql` khi thiếu phiên bản Hành khách. Script chuyển `viewer` cũ sang `passenger`, giữ hash mật khẩu, xóa các phiên vai trò cũ rồi loại `viewer` khỏi ENUM. Admin/operator được giữ nguyên. Chạy lặp không tạo lại dữ liệu mẫu hoặc xóa tài khoản.

React có nhánh route và sidebar riêng cho passenger. Express đăng ký các endpoint passenger trước bộ chặn toàn bộ API nội bộ; endpoint nội bộ chỉ cho admin/operator. Mọi danh sách/hủy đăng ký cá nhân đều được ràng buộc theo user.Id phía máy chủ.

DAO chuyến hành khách chỉ chọn các trường cần cho hành trình, xe, giá và chỗ còn lại; không trả CMT, hồ sơ tài xế, lương hay doanh thu. Giao dịch giữ chỗ kiểm tra lại giá, ngày và tổng khách trên dòng khóa; không chỉ dựa vào dữ liệu giao diện. Một đăng ký đã hủy có thể được kích hoạt lại; lịch sử thao tác chi tiết nằm trong APP_NHAT_KY.

Bản sao lưu trong app vẫn là bốn bảng nghiệp vụ; không phải bản sao lưu toàn bộ MySQL. Phục hồi bảo toàn đăng ký hiện tại tương thích, từ chối làm mất quyền giữ chỗ của chuyến tương lai; đăng ký lịch sử giữ thông tin xác nhận JSON.

## Tải giao diện khởi động (1.3.1)

`desktop/bootstrap.cjs` nạp trước năm tài nguyên cố định từ `app.getAppPath()`. Main đăng ký giao thức `vanhanh-ui` standard/secure trước app.ready, gắn handler vào đúng session `vanhanh-runtime`, rồi tải trang chờ và cấu hình qua URL nội bộ. Không chuyển đường dẫn đĩa Windows thành URL HTML. Chỉ trang cấu hình và origin backend được gọi IPC; trang chờ chỉ được điều hướng. Handler không phục vụ đường dẫn ngoài danh sách cho phép và không tắt CSP hoặc sandbox.
