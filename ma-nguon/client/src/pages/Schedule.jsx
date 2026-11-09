import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useData } from "../lib/hooks";
import { queryString } from "../lib/api";
import { date, shiftDate, todayLocal } from "../lib/format";
import { useAuth } from "../lib/context";
import { Button, ErrorBox, Field, PageHeading, Notice } from "../components/UI";
import RecordDetail from "../components/RecordDetail";
export default function Schedule() {
  const { options } = useOutletContext(),
    { user } = useAuth(),
    navigate = useNavigate(),
    today = options?.clock.today || todayLocal(),
    [start, setStart] = useState(today),
    [bus, setBus] = useState(""),
    [term, setTerm] = useState(""),
    [detail, setDetail] = useState(null),
    end = shiftDate(start, 6);
  const { data, loading, error, reload } = useData(
      "/api/schedule?" + queryString({ start, end, BienSo: bus }),
    ),
    rows = (data?.rows || []).filter((row) =>
      Object.values(row).some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term.toLowerCase()),
      ),
    );
  return (
    <>
      <PageHeading
        eyebrow="SẮP XẾP HÀNH TRÌNH"
        title="Lịch trình chuyến xe"
        description="Theo dõi các chuyến theo ngày, chọn xe và mở thông tin phân công."
      >
        {["admin", "operator"].includes(user.VaiTro) && (
          <Button icon={Plus} onClick={() => navigate("/chuyen-xe?new=1")}>
            Lập chuyến mới
          </Button>
        )}
      </PageHeading>
      <div className="filters-bar">
        <Field label="Bắt đầu tuần hiển thị">
          <input
            type="date"
            value={start}
            onChange={(event) =>
              event.target.value && setStart(event.target.value)
            }
          />
        </Field>
        <Field label="Xe khách">
          <select value={bus} onChange={(event) => setBus(event.target.value)}>
            <option value="">Tất cả xe</option>
            {options?.buses.map((row) => (
              <option key={row.BienSo}>{row.BienSo}</option>
            ))}
          </select>
        </Field>
        <Field label="Tìm chuyến / tài xế">
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Nhập từ khóa…"
          />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => setStart(shiftDate(start, -7))}
          >
            Tuần trước
          </Button>
          <Button variant="secondary" onClick={() => setStart(today)}>
            Hôm nay
          </Button>
          <Button
            variant="secondary"
            icon={ChevronRight}
            onClick={() => setStart(shiftDate(start, 7))}
          >
            Tuần sau
          </Button>
        </div>
      </div>
      <ErrorBox error={error} retry={reload} />
      <div className="table-description">
        <span>
          {date(start)} — {date(end)}
        </span>
        <span>
          {loading ? "Đang cập nhật…" : `${rows.length} chuyến trong lịch`}
        </span>
      </div>
      <div className="calendar-grid">
        {Array.from({ length: 7 }, (_, index) => {
          const day = shiftDate(start, index),
            trips = rows.filter((row) => row.NgayThucHien === day),
            weekday = new Intl.DateTimeFormat("vi-VN", {
              weekday: "long",
            }).format(new Date(`${day}T12:00:00`));
          return (
            <section
              className={`calendar-day ${day === today ? "is-today" : ""}`}
              key={day}
            >
              <div className="calendar-date">
                {weekday}
                <strong>{day.slice(8, 10)}</strong>
                <span>{date(day).slice(3)}</span>
              </div>
              {trips.map((row) => (
                <button
                  className="calendar-trip"
                  key={row.MaSoChuyenXe}
                  onClick={() => setDetail(row.MaSoChuyenXe)}
                >
                  <strong>{row.MaSoChuyenXe}</strong>
                  <span>
                    {row.DiemDau} → {row.DiemCuoi}
                  </span>
                  <small>{row.BienSo}</small>
                  <small>{row.TenLaiXe}</small>
                </button>
              ))}
              {!trips.length && (
                <p className="calendar-empty">Chưa có chuyến</p>
              )}
            </section>
          );
        })}
      </div>
      {Number(data?.total) > 10000 && (
        <Notice>
          Lịch có trên 10.000 chuyến. Hãy chọn một xe để thu hẹp kết quả.
        </Notice>
      )}
      {detail && (
        <RecordDetail
          entity="trips"
          id={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
