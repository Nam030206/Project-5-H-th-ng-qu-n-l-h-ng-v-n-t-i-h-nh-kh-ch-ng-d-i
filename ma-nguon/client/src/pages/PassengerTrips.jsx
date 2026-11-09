import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BusFront, Check, Ticket } from "lucide-react";
import { useData, useDebounce } from "../lib/hooks";
import { useToast } from "../lib/context";
import { api, queryString } from "../lib/api";
import { date, money, number, tripRevenue } from "../lib/format";
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageHeading,
  Table,
} from "../components/UI";

export function Journey({ row }) {
  return (
    <div className="journey-route">
      <div>
        <strong>{row.DiemDau}</strong>
        <ArrowRight size={14} />
        <strong>{row.DiemCuoi}</strong>
      </div>
      <small>
        {row.MaSoChuyenXe} · {row.MaTuyen}
      </small>
    </div>
  );
}

function BookingForm({ trip, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/passenger/bookings", {
        method: "POST",
        body: {
          MaSoChuyenXe: trip.MaSoChuyenXe,
          SoLuong: Number(quantity),
          GiaVe: trip.GiaVe,
        },
      });
      toast("Đã đăng ký chuyến thành công. Xem lại trong Chuyến đã đăng ký.");
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
      title={`Đăng ký chuyến ${trip.MaSoChuyenXe}`}
      description="Kiểm tra hành trình và số chỗ trước khi xác nhận."
      onClose={() => !busy && onClose()}
    >
      <div className="booking-summary">
        <Journey row={trip} />
        <div className="booking-summary-meta">
          <span>
            Ngày đi <strong>{date(trip.NgayThucHien)}</strong>
          </span>
          <span>
            Xe <strong>{trip.BienSo}</strong>
          </span>
          <span>
            Giá mỗi chỗ <strong>{money(trip.GiaVe)}</strong>
          </span>
          <span>
            Còn lại <strong>{number(trip.SoChoConLai)} chỗ</strong>
          </span>
        </div>
      </div>
      <form onSubmit={submit}>
        <Field
          label="Số chỗ đăng ký"
          hint={`Từ 1 đến ${trip.SoChoConLai} chỗ. Mỗi tài khoản có một đăng ký đang hiệu lực cho mỗi chuyến.`}
        >
          <input
            aria-label="Số chỗ đăng ký"
            type="number"
            required
            min={1}
            max={trip.SoChoConLai}
            step={1}
            autoFocus
            disabled={busy}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <div className="booking-total">
          <span>Tổng tiền theo giá vé</span>
          <strong>{money(tripRevenue(quantity, trip.GiaVe))}</strong>
        </div>
        <Notice>
          Đăng ký này giữ chỗ cho hành trình và chưa ghi nhận thanh toán. Bạn có
          thể hủy trước ngày đi.
        </Notice>
        <ErrorBox error={error} />
        <div className="form-footer">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Quay lại
          </Button>
          <Button type="submit" icon={Check} loading={busy}>
            Xác nhận đăng ký
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PassengerTrips() {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    [search, setSearch] = useState(params.get("q") || params.get("trip") || ""),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState({ start: "", end: "", available: "" }),
    [booking, setBooking] = useState(null),
    term = useDebounce(search),
    { data, loading, error, reload } = useData(
      "/api/passenger/trips?" +
        queryString({ q: term, page, limit: 10, ...filters }),
    );
  useEffect(() => {
    setSearch(params.get("q") || params.get("trip") || "");
    setPage(1);
  }, [params]);
  function filter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  return (
    <>
      <PageHeading
        eyebrow="HÀNH TRÌNH CỦA BẠN"
        title="Bạn muốn đi đâu?"
        description="Tìm chuyến phù hợp, chọn số chỗ và sẵn sàng cho hành trình mới."
      >
        <Button
          variant="secondary"
          icon={Ticket}
          onClick={() => navigate("/chuyen-da-dang-ky")}
        >
          Chuyến đã đăng ký
        </Button>
      </PageHeading>
      <section className="passenger-banner">
        <div className="passenger-banner-icon">
          <BusFront size={27} />
        </div>
        <div>
          <h2>Chọn chuyến dễ dàng, an tâm giữ chỗ</h2>
          <p>
            Thông tin tuyến, giá vé và chỗ trống được cập nhật khi bạn đăng ký.
            Đăng ký và hủy trước ngày khởi hành.
          </p>
        </div>
        <Badge tone="indigo">Tài khoản Hành khách</Badge>
      </section>
      <Table
        columns={[
          {
            key: "MaSoChuyenXe",
            label: "Hành trình",
            render: (_, row) => <Journey row={row} />,
          },
          { key: "NgayThucHien", label: "Ngày đi", render: date },
          {
            key: "BienSo",
            label: "Xe",
            render: (value, row) => (
              <div className="journey-route">
                <strong>{value}</strong>
                <small>
                  {row.HangSanXuat} · {row.Model}
                </small>
              </div>
            ),
          },
          { key: "GiaVe", label: "Giá mỗi chỗ", render: money },
          {
            key: "SoChoConLai",
            label: "Chỗ trống",
            render: (value) => (
              <Badge tone={Number(value) > 0 ? "green" : "red"}>
                {Number(value) > 0 ? `${value} chỗ` : "Hết chỗ"}
              </Badge>
            ),
          },
        ]}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPage={setPage}
        loading={loading}
        error={error}
        retry={reload}
        search={search}
        searchPlaceholder="Tìm nơi đi, nơi đến hoặc mã chuyến..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={
          <>
            <input
              type="date"
              aria-label="Ngày đi từ"
              value={filters.start}
              onChange={(event) => filter("start", event.target.value)}
            />
            <input
              type="date"
              aria-label="Ngày đi đến"
              value={filters.end}
              onChange={(event) => filter("end", event.target.value)}
            />
            <select
              aria-label="Lọc chỗ trống"
              value={filters.available}
              onChange={(event) => filter("available", event.target.value)}
            >
              <option value="">Tất cả chuyến sắp tới</option>
              <option value="1">Chuyến còn chỗ</option>
            </select>
          </>
        }
        empty="Chưa có chuyến phù hợp. Hãy thử ngày hoặc tuyến khác."
        rowActions={(row) =>
          Number(row.SoLuongDaDangKy) > 0 ? (
            <Button
              variant="secondary"
              icon={Ticket}
              onClick={() =>
                navigate(
                  "/chuyen-da-dang-ky?q=" +
                    encodeURIComponent(row.MaSoChuyenXe),
                )
              }
            >
              Đã đăng ký {row.SoLuongDaDangKy} chỗ
            </Button>
          ) : (
            <Button
              icon={Ticket}
              disabled={Number(row.SoChoConLai) < 1}
              onClick={() => setBooking(row)}
            >
              Đăng ký
            </Button>
          )
        }
      />
      <div className="passenger-footnote">
        Việc đăng ký và hủy được mở đến hết ngày trước ngày đi. Bạn có thể xem
        lại xác nhận trong Chuyến đã đăng ký.
      </div>
      {booking && (
        <BookingForm
          trip={booking}
          onClose={() => setBooking(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
