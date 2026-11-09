import { useState } from "react";
import { Activity, BusFront, Download, Users } from "lucide-react";
import { useData } from "../lib/hooks";
import { download, queryString } from "../lib/api";
import { number, todayLocal } from "../lib/format";
import { useToast } from "../lib/context";
import {
  Badge,
  Button,
  Field,
  Notice,
  PageHeading,
  StatCard,
  Table,
} from "../components/UI";
const types = {
  passengers: {
    label: "Khách theo tuyến",
    columns: ["MaTuyen", "DiemDau", "DiemCuoi", "SoChuyen", "TongSoKhach"],
  },
  occupancy: {
    label: "Tỷ lệ sử dụng chỗ",
    columns: [
      "MaSoChuyenXe",
      "NgayThucHien",
      "BienSo",
      "MaTuyen",
      "SoKhach",
      "SoChoNgoiQuyDinh",
      "TyLeSuDung",
    ],
  },
  inactive: {
    label: "Xe ít hoạt động",
    columns: [
      "BienSo",
      "HangSanXuat",
      "Model",
      "NgayChayGanNhat",
      "SoNgayKhongHoatDong",
    ],
  },
};
export default function Analytics() {
  const today = todayLocal(),
    [type, setType] = useState("passengers"),
    [filters, setFilters] = useState({
      start: today.slice(0, 7) + "-01",
      end: today,
      days: 7,
    }),
    [applied, setApplied] = useState(filters),
    toast = useToast();
  const { data, loading, error, reload } = useData(
      "/api/reports/" + type + "?" + queryString(applied),
    ),
    rows = data?.rows || [],
    max = Math.max(1, ...rows.map((row) => Number(row.TongSoKhach || 0)));
  async function exportData() {
    try {
      await download(
        `/api/reports/${type}/export?${queryString(applied)}`,
        `phan-tich-${type}.xlsx`,
      );
    } catch (error) {
      toast(error.message, "error");
    }
  }
  function submit(event) {
    event.preventDefault();
    if (type !== "inactive" && filters.start > filters.end) {
      toast("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.", "error");
      return;
    }
    setApplied({ ...filters });
    reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="HIỂU RÕ HOẠT ĐỘNG"
        title="Phân tích vận hành"
        description="Tìm hiểu nhu cầu hành khách, hiệu quả sử dụng chỗ và tần suất hoạt động của đội xe."
      >
        <Button icon={Download} onClick={exportData}>
          Xuất Excel
        </Button>
      </PageHeading>
      <div className="tabs">
        {Object.entries(types).map(([key, value]) => (
          <button
            key={key}
            className={`tab ${type === key ? "active" : ""}`}
            onClick={() => setType(key)}
          >
            {value.label}
          </button>
        ))}
      </div>
      <form className="filters-bar" onSubmit={submit}>
        {type === "inactive" ? (
          <Field label="Số ngày không có chuyến">
            <input
              type="number"
              required
              min={1}
              max={3650}
              value={filters.days}
              onChange={(event) =>
                setFilters({ ...filters, days: event.target.value })
              }
            />
          </Field>
        ) : (
          <>
            <Field label="Từ ngày">
              <input
                type="date"
                required
                value={filters.start}
                onChange={(event) =>
                  setFilters({ ...filters, start: event.target.value })
                }
              />
            </Field>
            <Field label="Đến ngày">
              <input
                type="date"
                required
                value={filters.end}
                onChange={(event) =>
                  setFilters({ ...filters, end: event.target.value })
                }
              />
            </Field>
          </>
        )}
        <Button type="submit" loading={loading}>
          Xem phân tích
        </Button>
      </form>
      {type === "passengers" && rows.length > 0 && (
        <section className="panel mb-5">
          <div className="panel-heading">
            <div>
              <h2>Lượng hành khách theo tuyến</h2>
              <p>Tổng số khách trên các chuyến đã thực hiện trong kỳ</p>
            </div>
            <Users size={18} className="muted" />
          </div>
          <div className="route-bars">
            {rows.map((row) => (
              <div className="route-bar" key={row.MaTuyen}>
                <div className="route-bar-top">
                  <strong>
                    {row.DiemDau} → {row.DiemCuoi}
                  </strong>
                  <span>
                    {number(row.TongSoKhach)} khách · {row.SoChuyen} chuyến
                  </span>
                </div>
                <div className="route-bar-track">
                  <i
                    style={{
                      width: `${(Number(row.TongSoKhach) / max) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <Table
        columns={types[type].columns.map((key) => ({
          key,
          ...(key === "TyLeSuDung"
            ? {
                render: (value) =>
                  value === null ? (
                    "Không áp dụng"
                  ) : (
                    <Badge
                      tone={
                        Number(value) >= 80
                          ? "green"
                          : Number(value) >= 50
                            ? "blue"
                            : "amber"
                      }
                    >
                      {number(value)}%
                    </Badge>
                  ),
              }
            : {}),
          ...(key === "SoNgayKhongHoatDong"
            ? {
                render: (value, row) =>
                  row.NgayChayGanNhat ? (
                    `${value} ngày`
                  ) : (
                    <Badge>Chưa có chuyến</Badge>
                  ),
              }
            : {}),
        }))}
        rows={rows}
        loading={loading}
        error={error}
        retry={reload}
      />
      {type === "occupancy" && (
        <Notice>
          Tỷ lệ = số khách / (số ghế − 2) × 100%. Xe có số chỗ chở khách bằng 0
          được ghi “Không áp dụng”. Số ghế được lấy theo thông tin xe hiện đang
          lưu.
        </Notice>
      )}
      {type === "inactive" && (
        <Notice>
          Liệt kê xe có ngày thực hiện chuyến gần nhất cách hôm nay ít nhất{" "}
          {applied.days} ngày, cùng các xe chưa có chuyến đã thực hiện. Chuyến
          tương lai chưa được tính.
        </Notice>
      )}
    </>
  );
}
