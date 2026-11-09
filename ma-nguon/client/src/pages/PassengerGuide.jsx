import { CalendarDays, ShieldCheck, Ticket } from "lucide-react";
import { PageHeading } from "../components/UI";
export default function PassengerGuide() {
  return (
    <>
      <PageHeading
        eyebrow="ĐỒNG HÀNH CÙNG BẠN"
        title="Hướng dẫn cho hành khách"
        description="Tìm chuyến, đăng ký chỗ và quản lý hành trình của bạn."
      />
      <div className="guide-grid">
        <section className="guide-card">
          <h2>
            <Ticket size={18} /> Đăng ký chuyến
          </h2>
          <ol>
            <li>Vào Tìm chuyến và chọn nơi đi, nơi đến hoặc khoảng ngày.</li>
            <li>Chọn Đăng ký ở chuyến còn chỗ.</li>
            <li>Nhập số chỗ, kiểm tra ngày đi và tổng tiền theo giá vé.</li>
            <li>Chọn Xác nhận đăng ký. Chỗ trống được kiểm tra lại khi lưu.</li>
            <li>Mở Chuyến đã đăng ký để xem xác nhận.</li>
          </ol>
          <p>
            Mỗi tài khoản có một đăng ký đang hiệu lực cho mỗi chuyến. Bạn có
            thể đăng ký nhiều chỗ trong một lần. Xác nhận đăng ký chưa phải xác
            nhận thanh toán.
          </p>
        </section>
        <section className="guide-card">
          <h2>
            <CalendarDays size={18} /> Thay đổi kế hoạch
          </h2>
          <p>
            Bạn có thể đăng ký và hủy đến hết ngày trước ngày khởi hành. Mở
            Chuyến đã đăng ký → Hủy đăng ký → Xác nhận hủy. Chỗ đã giữ sẽ được
            trả lại cho chuyến.
          </p>
          <p>
            Muốn đổi số chỗ, hủy đăng ký cũ rồi đăng ký lại nếu chuyến vẫn còn
            chỗ. Nếu nhà xe hủy chuyến, lý do hủy được lưu trong chi tiết đăng
            ký.
          </p>
        </section>
        <section className="guide-card">
          <h2>
            <ShieldCheck size={18} /> Tài khoản của bạn
          </h2>
          <p>
            Tài khoản tự đăng ký là Hành khách. Bạn chỉ có thể xem và quản lý
            đăng ký của chính mình. Hãy giữ riêng mật khẩu và đăng xuất khi sử
            dụng máy dùng chung.
          </p>
          <p>
            Thông tin tuyến, xe, ngày đi và giá vé được hiển thị khi xác nhận.
            Nếu thông tin vừa thay đổi hoặc đã hết chỗ, ứng dụng sẽ thông báo để
            bạn chọn lại.
          </p>
        </section>
      </div>
    </>
  );
}
