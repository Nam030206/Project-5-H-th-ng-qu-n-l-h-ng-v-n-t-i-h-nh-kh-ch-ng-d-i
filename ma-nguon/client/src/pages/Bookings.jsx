import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ban, Eye, Search, Ticket } from "lucide-react";
import { useAuth, useToast } from "../lib/context";
import { useData, useDebounce } from "../lib/hooks";
import { api, queryString } from "../lib/api";
import { date, dateTime, money } from "../lib/format";
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  IconButton,
  Modal,
  PageHeading,
  Table,
} from "../components/UI";
import { Journey } from "./PassengerTrips";

function CancelBooking({ booking, endpoint, onClose, onSaved }) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`${endpoint}/${booking.Id}/cancel`, {
        method: "POST",
        body: { LyDoHuy: reason },
      });
      toast("Đã hủy đăng ký và cập nhật lại chỗ trống.");
      onSaved();
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Hủy đăng ký #${booking.Id}`}
      description="Đăng ký chỉ bị hủy sau khi bạn xác nhận."
      onClose={() => !busy && onClose()}
    >
      <div className="booking-summary">
        <Journey row={booking} />
        <p>
          {date(booking.NgayThucHien)} · {booking.SoLuong} chỗ ·{" "}
          {money(booking.ThanhTien)}
        </p>
      </div>
      <form onSubmit={submit}>
        <Field label="Lý do hủy (không bắt buộc)">
          <textarea
            aria-label="Lý do hủy"
            rows={3}
            maxLength={255}
            disabled={busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Thay đổi kế hoạch"
          />
        </Field>
        <ErrorBox error={error} />
        <div className="form-footer">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Giữ đăng ký
          </Button>
          <Button type="submit" variant="danger" icon={Ban} loading={busy}>
            Xác nhận hủy
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BookingDetail({ booking, onClose, staff }) {
  const fields = [
    ...(staff
      ? [
          ["Hành khách", booking.HoTen],
          ["Tên đăng nhập", booking.TenDangNhap],
        ]
      : []),
    ["Ngày đi", date(booking.NgayThucHien)],
    ["Xe", booking.BienSo],
    ["Số chỗ", booking.SoLuong],
    ["Giá mỗi chỗ", money(booking.GiaVeDangKy)],
    ["Tổng tiền theo giá vé", money(booking.ThanhTien)],
    ["Đăng ký lúc", dateTime(booking.NgayDangKy)],
    ["Trạng thái", booking.TrangThai === "confirmed" ? "Đã đăng ký" : "Đã hủy"],
    ...(booking.NgayHuy
      ? [
          ["Hủy lúc", dateTime(booking.NgayHuy)],
          ["Lý do hủy", booking.LyDoHuy],
        ]
      : []),
  ];
  return (
    <Modal
      title={`Đăng ký #${booking.Id}`}
      description="Thông tin xác nhận đăng ký chuyến xe."
      onClose={onClose}
    >
      <div className="booking-summary">
        <Journey row={booking} />
      </div>
      <dl className="booking-details">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="passenger-footnote">
        Đây là xác nhận đăng ký chỗ; chưa phải xác nhận thanh toán.
      </p>
      <div className="form-footer">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Modal>
  );
}

export default function Bookings() {
  const { user } = useAuth(),
    staff = user.VaiTro !== "passenger",
    endpoint = staff ? "/api/bookings" : "/api/passenger/bookings",
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [search, setSearch] = useState(params.get("q") || ""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    [cancelling, setCancelling] = useState(null),
    term = useDebounce(search),
    { data, loading, error, reload } = useData(
      endpoint + "?" + queryString({ q: term, status, page, limit: 10 }),
    );
  useEffect(() => {
    setSearch(params.get("q") || "");
    setPage(1);
  }, [params]);
  return (
    <>
      <PageHeading
        eyebrow={staff ? "QUẢN LÝ HÀNH KHÁCH" : "HÀNH TRÌNH CỦA BẠN"}
        title={staff ? "Đăng ký hành khách" : "Chuyến đã đăng ký"}
        description={
          staff
            ? "Tra cứu người đăng ký, số chỗ và xử lý hủy trước ngày đi."
            : "Xem xác nhận, theo dõi hành trình và hủy đăng ký trước ngày đi."
        }
      >
        {!staff && (
          <Button icon={Search} onClick={() => navigate("/")}>
            Tìm chuyến mới
          </Button>
        )}
      </PageHeading>
      <Table
        columns={[
          {
            key: "Id",
            label: "Mã đăng ký",
            render: (value) => <strong>#{value}</strong>,
          },
          ...(staff
            ? [
                {
                  key: "HoTen",
                  label: "Hành khách",
                  render: (value, row) => (
                    <div className="journey-route">
                      <strong>{value}</strong>
                      <small>{row.TenDangNhap}</small>
                    </div>
                  ),
                },
              ]
            : []),
          {
            key: "MaSoChuyenXe",
            label: "Hành trình",
            render: (_, row) => <Journey row={row} />,
          },
          { key: "NgayThucHien", label: "Ngày đi", render: date },
          { key: "SoLuong", label: "Số chỗ" },
          { key: "ThanhTien", label: "Tổng tiền theo giá vé", render: money },
          {
            key: "TrangThai",
            label: "Trạng thái",
            render: (value) => (
              <Badge tone={value === "confirmed" ? "green" : "slate"}>
                {value === "confirmed" ? "Đã đăng ký" : "Đã hủy"}
              </Badge>
            ),
          },
        ]}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPage={setPage}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={
          staff
            ? "Tìm hành khách, mã chuyến hoặc tuyến..."
            : "Tìm mã chuyến hoặc tuyến..."
        }
        loading={loading}
        error={error}
        retry={reload}
        filters={
          <select
            aria-label="Trạng thái đăng ký"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="confirmed">Đã đăng ký</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        }
        empty={
          staff
            ? "Chưa có đăng ký hành khách phù hợp."
            : "Bạn chưa có đăng ký chuyến phù hợp."
        }
        rowActions={(row) => (
          <>
            <IconButton
              icon={Eye}
              label="Chi tiết đăng ký"
              onClick={() => setDetail(row)}
            />
            <IconButton
              icon={Ban}
              label="Hủy đăng ký"
              disabled={!row.CoTheHuy}
              onClick={() => setCancelling(row)}
            />
          </>
        )}
      />
      <div className="passenger-footnote">
        <Ticket size={15} /> Có thể hủy đến hết ngày trước ngày đi. Nếu nhà xe
        hủy chuyến, trạng thái đăng ký và lý do hủy sẽ được cập nhật tại đây.
      </div>
      {detail && (
        <BookingDetail
          booking={detail}
          staff={staff}
          onClose={() => setDetail(null)}
        />
      )}
      {cancelling && (
        <CancelBooking
          booking={cancelling}
          endpoint={endpoint}
          onClose={() => setCancelling(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
