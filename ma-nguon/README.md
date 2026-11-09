# Vận Hành Desktop — Project 5

Đây là **ứng dụng desktop Electron**, mở bằng tệp `.exe`, có cửa sổ và menu riêng. Người sử dụng không mở trang web, không nhập địa chỉ localhost và không tự chạy backend. Giao diện giữ **React + Tailwind CSS + Lucide**; dữ liệu lưu trong **MySQL**.

## Mở app Windows đã đóng gói

1. Giải nén toàn bộ ZIP.
2. Bật dịch vụ **MySQL Server** mà bạn đang sử dụng với Workbench.
3. Nhấp đúp **`VanHanh.exe`** ở ngoài cùng của bản giao. Đây là bản chạy từ thư mục Windows x64, đã kèm bộ chạy; không cần cài Node.js hoặc chạy npm. Giữ nguyên các tệp .dll, locales và resources cạnh VanHanh.exe.
4. Lần đầu, app mở màn hình **Kết nối cơ sở dữ liệu**. Nhập máy chủ, cổng, tài khoản, mật khẩu MySQL và tên CSDL. Thường dùng `127.0.0.1`, cổng `3306`, tên `Project5_VanTai`.
5. Nhấn **Kiểm tra kết nối**. Nếu cần, giữ chọn **Khởi tạo / nâng cấp cấu trúc CSDL**, rồi nhấn **Lưu & mở ứng dụng**. Dữ liệu hiện có được giữ nguyên; mẫu chỉ thêm khi cả bốn bảng nghiệp vụ đều trống.
6. Nếu chưa có tài khoản Vận Hành, tự tạo quản trị viên trên giao diện. Mã thiết lập được truyền nội bộ; không phải đọc mã từ terminal.

**Tài khoản Hành khách (bản 1.3.0):** chọn **Đăng ký** trên màn hình đăng nhập, nhập họ tên, tên đăng nhập, mật khẩu và nhập lại mật khẩu. Sau khi đăng ký thành công, đăng nhập để mở cổng hành khách. Chọn **Tìm chuyến → Đăng ký → số chỗ → Xác nhận đăng ký**. Xem và hủy tại **Chuyến đã đăng ký**. Chỉ đăng ký/hủy trước ngày đi; xác nhận này giữ chỗ và chưa ghi nhận thanh toán.

Ba vai trò hiện tại là **Quản trị viên**, **Nhân viên**, **Hành khách**. Tài khoản Người xem cũ được tự động chuyển sang Hành khách khi mở bản mới, giữ mật khẩu và cần đăng nhập lại. Hành khách chỉ truy cập chuyến sắp tới và đăng ký của mình. Nhà xe xem danh sách và xử lý đăng ký tại **Đăng ký hành khách**.

**Để thử chức năng:** đăng nhập quản trị hoặc nhân viên, vào **Chuyến xe → Thêm chuyến xe** và chọn ngày đi từ ngày mai. Dữ liệu mẫu của đề chủ yếu là chuyến lịch sử nên có thể chưa có chuyến mở đăng ký. App không tự tạo chuyến tương lai trong CSDL đang sử dụng.

Các lần sau chỉ cần bật MySQL và mở `VanHanh.exe`. Tài khoản MySQL khác với tài khoản đăng nhập Vận Hành. Bản Windows đã chứa Electron và bộ xử lý Node.js; **MySQL Server vẫn cần có trên máy hoặc máy chủ mà bạn kết nối**.

## Bản sửa khởi động 1.3.1

Bản này sửa cách tải màn hình chờ và màn hình kết nối MySQL: tài nguyên được đọc từ gói ứng dụng qua giao thức nội bộ, không đưa đường dẫn Windows vào URL file của giao diện. Trang chờ lỗi vẫn cho phép tiếp tục tới màn hình cấu hình. Sandbox, context isolation, kiểm tra nguồn IPC và quyền tài khoản được giữ.

**Mở bản mới:** đóng ứng dụng cũ, giải nén toàn bộ ZIP sang một thư mục mới rồi mở `VanHanh_Desktop/VanHanh.exe`. Giữ nguyên các tệp `.dll`, thư mục `resources`, `locales` và các tệp đi kèm. Bản này chạy trực tiếp từ thư mục đã giải nén. Tiếp tục dùng CSDL MySQL và tài khoản hiện có.

Đóng gói dạng thư mục từ mã nguồn trên Windows: `npx electron-builder --win --x64 --dir --publish never` sau khi cài thư viện và build giao diện. Thư mục chạy nằm ở `release/win-unpacked`.

## Các phần đã chuyển thành desktop

- Cửa sổ hệ điều hành riêng, biểu tượng và menu tiếng Việt.
- Backend tự khởi động cùng app, chỉ nghe loopback ở cổng do hệ điều hành chọn; tự dừng khi đóng app.
- Màn hình nhập/kiểm tra/lưu kết nối MySQL; không yêu cầu người dùng sửa `.env`.
- Mật khẩu MySQL được bảo vệ qua kho khóa hệ điều hành khi khả dụng. Nếu kho khóa không dùng được, app hỏi lại mật khẩu; không lưu bản dự phòng dạng văn bản.
- Hộp thoại lưu tệp, in và lưu PDF; menu **Tệp → Lưu thành PDF**.
- Một phiên ứng dụng tại một thời điểm; mở lại biểu tượng đưa cửa sổ đang có lên trước.
- QR dùng liên kết `vanhanh://trip/MACHUYEN` cho bản đóng gói; mở chuyến vẫn cần đăng nhập.
- Chỉ liên kết bản đồ ngoài được mở ra trình duyệt khi người dùng yêu cầu; nghiệp vụ chính nằm trong app.

Menu **Tệp → Kết nối MySQL** cho phép đổi kết nối. Đóng app không tắt dịch vụ MySQL Server của bạn.

## 1. Cấu trúc dự án và giao diện

| Thư mục / tệp                                 | Vai trò                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `desktop/main.mjs`                            | Vòng đời app, cửa sổ, menu, IPC và MySQL setup |
| `desktop/preload.cjs`                         | API desktop giới hạn cho giao diện             |
| `desktop/backend-service.cjs`                 | Bộ xử lý dữ liệu chạy theo app                 |
| `desktop/config-store.cjs`                    | Lưu cấu hình và tích hợp mã hóa mật khẩu       |
| `desktop/policy.cjs`                          | Deep link, origin và liên kết ngoài            |
| `desktop/setup.html`, `setup.css`, `setup.js` | Màn hình kết nối MySQL                         |
| `client/src/components/`                      | Main Layout, bảng, modal, form và chi tiết     |
| `client/src/pages/`                           | Dashboard và từng module chức năng             |
| `client/src/styles.css`                       | Tailwind, sáng/tối, bố cục và in ấn            |
| `server/controllers/`, `services/`, `dao/`    | Tiếp nhận request → nghiệp vụ → truy vấn MySQL |
| `server/config/`, `middleware/`               | Cấu hình, phiên, CSRF, phân quyền, bắt lỗi     |
| `database/01_project5.sql`                    | SQL gốc đã thống nhất, bốn bảng nghiệp vụ      |
| `database/02_app.sql`                         | Tài khoản, phiên đăng nhập, nhật ký            |
| `assets/`                                     | Icon SVG/PNG/ICO                               |
| `electron-builder.yml`                        | Cấu hình đóng gói Windows                      |
| `docs/`                                       | Đối chiếu tính năng, API và kiểm thử           |

Sidebar trái, thanh công cụ và vùng nội dung rộng. Các màn hình quản lý có tìm kiếm, bộ lọc, phân trang, sửa/xóa/chi tiết, thêm/sửa bằng dialog và toast. Dashboard hiển thị số liệu, doanh thu bảy ngày, chuyến từ hôm nay, bảo dưỡng và tuyến nổi bật. Các màn hình này được hiển thị trong cửa sổ Electron.

## 2. Khung giao diện và styling

Toàn bộ mã nằm trong ZIP, không phải tự ghép các đoạn code:

- `client/src/components/Layout.jsx`: Sidebar, Header và bố cục chính.
- `client/src/pages/Dashboard.jsx`: Dashboard, biểu đồ từ MySQL.
- `client/src/styles.css`: Tailwind v4, Slate/Indigo, sáng/tối, bảng, modal và in ấn.
- `desktop/main.mjs`: khung desktop, menu, bộ xử lý nội bộ và quyền thiết bị.

## 3. Module chức năng

Giữ bốn nhóm truy vấn của yêu cầu 2 và 24 tính năng đã thống nhất. Xem `docs/FEATURES.md` để đối chiếu từng tính năng; `docs/API.md` là tài liệu API nội bộ dành cho người phát triển.

### CSDL và công thức

- Bốn bảng nghiệp vụ giữ nguyên: `XE_KHACH`, `TAI_XE`, `TUYEN_DUONG`, `CHUYEN_XE`.
- Ba bảng hỗ trợ: `APP_TAI_KHOAN`, `APP_PHIEN_DANG_NHAP`, `APP_NHAT_KY`. Báo cáo số bản ghi theo đề chỉ đếm bốn bảng nghiệp vụ.
- Khách tối đa = số ghế − 2; lái chính khác phụ xe.
- Lương tháng = tổng `100000 × hệ số vai trò × hệ số lương tuyến` từ đầu tháng đến hôm nay. Lái chính 2, phụ xe 1; hệ số lương cấp 1/2/3 là 1,00/1,20/1,50.
- Doanh thu chuyến = số khách × giá vé. Báo cáo theo hai ngày biên được chọn, giữ xe doanh thu 0 và loại chuyến tương lai.
- Km làm việc = độ dài tuyến × hệ số đường khó 1,00/1,30/1,60 theo cấp 1/2/3.
- Hạn bảo dưỡng = ngày bảo dưỡng cuối + `360 − FLOOR(tổng km làm việc / 100)` ngày. Chỉ cộng chuyến từ lần bảo dưỡng gần nhất đến hôm nay.
- Ngày sinh, ngày đã chạy và ngày đã bảo dưỡng giữ theo lịch sử. Lương/hạn bảo dưỡng làm mới khi mở app, khi cần đọc và khoảng mỗi phút trong lúc app đang mở. Múi giờ MySQL +07:00.
- Chưa có giờ hoặc trạng thái hoàn tất riêng: lịch theo ngày; báo cáo coi chuyến có ngày thực hiện đến hôm nay là đã chạy. Chuyến không chạy cần hủy/đính chính.

### Tệp, QR, bản đồ

Nhập CSV UTF-8/Excel .xlsx tối đa 5 MB và 2.000 dòng; tải mẫu trong app. Nhập xe/tài xế/tuyến trước chuyến. Lỗi một dòng hoàn tác toàn bộ lần nhập. Xuất Excel/CSV giữ bộ lọc, tối đa 10.000 dòng. In/PDF phản ánh dữ liệu đang hiển thị. Giữ CMT dạng văn bản để không mất số 0 đầu.

Sao lưu/phục hồi JSON chỉ thay bốn bảng nghiệp vụ, giữ tài khoản và nhật ký hiện tại. Phục hồi cần xem trước, mật khẩu quản trị và nhập `PHUC HOI`; áp dụng trong giao dịch, giới hạn tệp 5 MB.

Quét QR cần camera và quyền của người dùng; có thể chọn ảnh hoặc nhập mã. Liên kết `vanhanh://` dùng trên máy có app desktop, không biến bản Windows thành app điện thoại. Bản đồ cần Internet; đường nối trong app chỉ minh họa hai đầu tuyến, độ dài nghiệp vụ lấy từ CSDL.

## Chạy từ mã nguồn

Phần này dành cho người phát triển. Người dùng `VanHanh.exe` không cần thực hiện.

Cần Node.js từ 22.12 và Internet cho lần cài thư viện. Trong thư mục chứa `package.json`:

```bash
npm ci
npm run build
npm start
```

`npm start` mở Electron. Trên Windows có thể chạy `SETUP_WINDOWS.bat`, sau đó `START_WINDOWS.bat`. Không cần tự chạy API hay Vite để sử dụng desktop.

Đóng gói bộ cài trên Windows:

```bash
npm run dist:win
```

Kết quả trong `release/`. `BUILD_WINDOWS.bat` cài thư viện và tạo bộ cài. Tạo portable bằng `npm run dist:portable`. Bản giao phục vụ đồ án chưa ký số.

## Kiểm thử

```bash
npm test
```

Integration test chỉ dùng CSDL thử bắt đầu `VanHanhTest`; có bước xóa/khởi tạo lại CSDL thử. Không chạy vào CSDL làm bài:

```powershell
$env:DB_NAME="VanHanhTestLocal"
npm run test:integration
```

Xem `docs/TESTING.md` và `docs/verification.json` về phạm vi đã kiểm tra. Đóng gói thành công `.exe` không đồng nghĩa đã chạy nghiệm thu giao diện trên Windows thực.

## Nếu không kết nối được

- Bật **MySQL Server**; chỉ mở Workbench là chưa đủ.
- Dùng host/cổng/tài khoản/mật khẩu của connection đang hoạt động trong Workbench.
- Nếu thiếu bảng/procedure, chọn khởi tạo/nâng cấp trên màn hình kết nối; tài khoản MySQL cần quyền tạo bảng, view, trigger, procedure.
- Khi đổi host hoặc tài khoản MySQL, nhập lại mật khẩu; app không tự gửi mật khẩu đã nhớ sang máy chủ khác.
- Cấu hình nằm trong thư mục dữ liệu ứng dụng của tài khoản hệ điều hành. Nếu kho khóa không sẵn sàng, nhập lại mật khẩu cho mỗi lần mở.
