import {
  BookOpen,
  BusFront,
  ChartColumnIncreasing,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import { Notice, PageHeading } from "../components/UI";
import { useAuth } from "../lib/context";
import PassengerGuide from "./PassengerGuide";
const features = [
  "Quản lý xe khách",
  "Quản lý tài xế",
  "Quản lý tuyến đường",
  "Lập chuyến và phân công nhân sự",
  "Điều chỉnh / hủy chuyến dự kiến",
  "Tìm kiếm và lọc dữ liệu",
  "Xem chi tiết chuyến xe",
  "Lịch chuyến theo ngày / tuần",
  "Lịch sử hoạt động của xe",
  "Lịch sử tham gia của tài xế",
  "Gợi ý xe đủ chỗ khi lập chuyến",
  "Kiểm tra dữ liệu ngay khi nhập",
  "Ghi nhận đã bảo dưỡng",
  "Nhập Excel / CSV",
  "Xuất Excel / CSV / PDF",
  "Sao lưu và phục hồi dữ liệu",
  "Nhân bản chuyến xe",
  "Lượng khách theo tuyến",
  "Tỷ lệ sử dụng chỗ",
  "Phát hiện xe lâu không hoạt động",
  "Tự đăng ký, đăng nhập và phân quyền",
  "Nhật ký thao tác",
  "Tra cứu chuyến bằng QR",
  "Bản đồ tuyến đường",
];
export default function Guide() {
  const { user } = useAuth();
  if (user.VaiTro === "passenger") return <PassengerGuide />;
  return (
    <>
      <PageHeading
        eyebrow="ĐỒNG HÀNH CÙNG BẠN"
        title="Hướng dẫn sử dụng"
        description="Những thao tác cơ bản, cách tính số liệu và quyền sử dụng hệ thống."
      />
      <div className="guide-grid">
        <section className="guide-card">
          <h2 className="flex items-center gap-2">
            <ClipboardCheck size={18} />
            Bắt đầu một chuyến xe
          </h2>
          <ol>
            <li>Thêm xe, tài xế và tuyến đường nếu chưa có.</li>
            <li>Vào Chuyến xe → Thêm chuyến xe.</li>
            <li>Chọn ngày, xe, tuyến, lái chính và phụ xe.</li>
            <li>Nhập số khách và giá vé, kiểm tra thông tin rồi lưu.</li>
            <li>Dùng Chi tiết để xem, in hoặc tải mã QR.</li>
          </ol>
          <p>
            Để lặp lại hành trình, dùng nút Nhân bản. Mã chuyến mới được tạo
            sẵn; số khách cần nhập lại.
          </p>
        </section>
        <section className="guide-card">
          <h2 className="flex items-center gap-2">
            <ShieldCheck size={18} />
            Quyền của từng người dùng
          </h2>
          <p>
            Chưa có tài khoản? Chọn Đăng ký trên màn hình đăng nhập, nhập họ
            tên, tên đăng nhập, mật khẩu và nhập lại mật khẩu. Đăng ký thành
            công rồi đăng nhập để sử dụng. Tài khoản tự đăng ký là Hành khách,
            có giao diện tìm chuyến và quản lý đăng ký riêng.
          </p>
          <ul>
            <li>
              <strong>Quản trị viên:</strong> quản lý toàn bộ dữ liệu, tài
              khoản, nhật ký, sao lưu và phục hồi.
            </li>
            <li>
              <strong>Nhân viên:</strong> thêm, sửa, nhập dữ liệu, ghi nhận bảo
              dưỡng; điều chỉnh / hủy chuyến có ngày thực hiện sau hôm nay.
            </li>
            <li>
              <strong>Hành khách:</strong> xem chuyến sắp tới, đăng ký chỗ, xem
              và hủy đăng ký của mình trước ngày đi. Không truy cập dữ liệu nội
              bộ.
            </li>
          </ul>
          <p>
            Quản trị viên có thể sửa thông tin lịch sử khi cần đính chính. Mọi
            thay đổi được ghi nhật ký.
          </p>
        </section>
        <section className="guide-card">
          <h2 className="flex items-center gap-2">
            <ChartColumnIncreasing size={18} />
            Lương và doanh thu
          </h2>
          <p>
            Lương chỉ tính các chuyến từ đầu tháng đến hôm nay. Mỗi chuyến:
            100.000đ × hệ số vai trò × hệ số lương tuyến. Vai trò lái chính có
            hệ số 2, phụ xe có hệ số 1. Độ phức tạp cấp 1, 2, 3 có hệ số lương
            lần lượt 1,00 · 1,20 · 1,50.
          </p>
          <p className="mt-3">
            Doanh thu chuyến = số khách × giá vé. Báo cáo doanh thu cộng các
            chuyến đã thực hiện trong khoảng chọn, bao gồm hai ngày biên; xe
            chưa có chuyến vẫn hiện số 0.
          </p>
        </section>
        <section className="guide-card">
          <h2 className="flex items-center gap-2">
            <BusFront size={18} />
            Bảo dưỡng và số chỗ
          </h2>
          <p>
            Km làm việc = độ dài tuyến × hệ số đường khó. Cấp 1, 2, 3 có hệ số
            lần lượt 1,00 · 1,30 · 1,60. Cộng km từ lần bảo dưỡng gần nhất đến
            hôm nay, chia 100 rồi làm tròn xuống để tính số ngày giảm.
          </p>
          <p className="mt-3">
            Hạn bảo dưỡng = ngày bảo dưỡng cuối + 360 ngày − số ngày giảm theo
            km. Ngày đến hạn được tính riêng với xe đã quá hạn.
          </p>
          <p className="mt-3">
            Số khách tối đa = số ghế − 2. Lái chính và phụ xe phải là hai người
            khác nhau.
          </p>
        </section>
        <section className="guide-card full">
          <h2 className="flex items-center gap-2">
            <BookOpen size={18} />
            24 tính năng bổ sung
          </h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ol>
        </section>
      </div>
      <Notice>
        Ngày sinh, ngày đã chạy và ngày đã bảo dưỡng được giữ theo lịch sử.
        Lương, hạn bảo dưỡng và báo cáo được làm mới khi mở màn hình và định kỳ
        khoảng một phút trong lúc máy chủ hoạt động. Bản đồ cần Internet; các
        nghiệp vụ chính dùng MySQL của bạn.
      </Notice>
    </>
  );
}
