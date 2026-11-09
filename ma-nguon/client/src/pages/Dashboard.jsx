import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Plus,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/context";
import { useData } from "../lib/hooks";
import { date, money, number, shiftDate } from "../lib/format";
import {
  Badge,
  Button,
  ErrorBox,
  PageHeading,
  StatCard,
  Table,
} from "../components/UI";
function RevenueChart({ data, today }) {
  if (!today) return <div className="empty-state">Đang tải biểu đồ…</div>;
  const days = Array.from({ length: 7 }, (_, index) =>
      shiftDate(today, index - 6),
    ),
    values = days.map((day) =>
      Number(data.find((row) => row.Ngay === day)?.DoanhThu || 0),
    );
  const maximum = Math.max(1000000, ...values) * 1.15,
    points = values.map((value, index) => [
      58 + index * 77,
      177 - (value / maximum) * 140,
    ]);
  const path = points
      .map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`)
      .join(" "),
    area = path + " L520,177 L58,177 Z";
  return (
    <svg
      className="chart-svg"
      viewBox="0 0 550 220"
      role="img"
      aria-label="Biểu đồ doanh thu thực tế trong 7 ngày"
    >
      <defs>
        <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7770ef" stopOpacity=".2" />
          <stop offset="100%" stopColor="#7770ef" stopOpacity=".01" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((index) => {
        const y = 37 + index * 46.67;
        return (
          <g key={index}>
            <line
              x1="58"
              x2="520"
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeDasharray="3 4"
            />
            <text x="3" y={y + 3}>
              {number((maximum * (3 - index)) / 3 / 1000000)} tr
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#revenue-area)" />
      <path
        d={path}
        fill="none"
        stroke="#7770ef"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], index) => (
        <g key={days[index]}>
          <circle
            cx={x}
            cy={y}
            r="3.2"
            fill="var(--surface)"
            stroke="#7770ef"
            strokeWidth="2"
          >
            <title>
              {date(days[index])}:{" "}
              {money(
                data.find((row) => row.Ngay === days[index])?.DoanhThu || 0,
              )}
            </title>
          </circle>
          <text x={x} y="203" textAnchor="middle">
            {date(days[index]).slice(0, 5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
export default function Dashboard() {
  const { user } = useAuth(),
    { data, loading, error, reload } = useData("/api/dashboard"),
    navigate = useNavigate(),
    metrics = data?.metrics || {};
  const routeMaximum = Math.max(
      1,
      ...(data?.routes || []).map((row) => Number(row.TongSoKhach)),
    ),
    weekly = (data?.trend || []).reduce(
      (sum, row) => sum + BigInt(String(row.DoanhThu).split(".")[0]),
      0n,
    );
  return (
    <>
      <PageHeading
        eyebrow="KHÔNG GIAN ĐIỀU HÀNH"
        title="Tổng quan vận hành"
        description={`Chào ${user.HoTen.split(" ").at(-1)}, cùng theo dõi những hành trình hôm nay.`}
      >
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={reload}
          loading={loading}
        >
          Làm mới
        </Button>
        {["admin", "operator"].includes(user.VaiTro) && (
          <Button icon={Plus} onClick={() => navigate("/chuyen-xe?new=1")}>
            Tạo chuyến mới
          </Button>
        )}
      </PageHeading>
      <ErrorBox error={error} retry={reload} />
      <div className="stats-grid">
        <StatCard
          label="Tổng số xe khách"
          value={number(metrics.TongXe)}
          description={`${number(metrics.TongTaiXe)} tài xế trong hệ thống`}
          icon={BusFront}
        />
        <StatCard
          label="Chuyến xe trong tháng"
          value={number(metrics.SoChuyen)}
          description={`Từ ${date(data?.clock.monthStart)} đến hôm nay`}
          icon={ClipboardList}
          tone="blue"
        />
        <StatCard
          label="Doanh thu trong tháng"
          value={money(metrics.DoanhThu)}
          description="Tổng doanh thu các chuyến đã thực hiện"
          icon={ChartNoAxesCombined}
          tone="green"
        />
        <StatCard
          label="Hành khách trong tháng"
          value={number(metrics.SoKhach)}
          description="Được ghi nhận trên các chuyến đã chạy"
          icon={Users}
          tone="amber"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Doanh thu theo ngày</h2>
              <p>Theo dõi hiệu quả hoạt động trong 7 ngày qua</p>
            </div>
            <span className="chart-legend">
              <i />
              Doanh thu
            </span>
          </div>
          <div className="chart-summary">
            <strong>{money(weekly)}</strong>
            <small>tổng trong 7 ngày</small>
          </div>
          <div className="chart-wrap">
            <RevenueChart data={data?.trend || []} today={data?.clock.today} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Tuyến đường nổi bật</h2>
              <p>Lượng hành khách trong tháng hiện tại</p>
            </div>
            <Badge tone="indigo">
              Tháng {data?.clock.today?.slice(5, 7) || "—"}
            </Badge>
          </div>
          <div className="route-bars">
            {data?.routes.map((row) => (
              <div className="route-bar" key={row.MaTuyen}>
                <div className="route-bar-top">
                  <strong>
                    {row.DiemDau} → {row.DiemCuoi}
                  </strong>
                  <span>{number(row.TongSoKhach)} khách</span>
                </div>
                <div className="route-bar-track">
                  <i
                    style={{
                      width: `${(Number(row.TongSoKhach) / routeMaximum) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!data?.routes.length && (
              <p className="muted">Chưa có dữ liệu tuyến đường.</p>
            )}
          </div>
          <div className="panel-bottom">
            <button
              className="text-link"
              onClick={() => navigate("/phan-tich")}
            >
              Khám phá phân tích <ArrowUpRight size={11} className="inline" />
            </button>
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Các chuyến từ hôm nay</h2>
              <p>Lịch trình và nhân sự phụ trách</p>
            </div>
            <button
              className="text-link"
              onClick={() => navigate("/chuyen-xe")}
            >
              Xem tất cả <ArrowRight size={12} className="inline" />
            </button>
          </div>
          <div className="mini-table">
            <Table
              hideSearch
              loading={loading}
              rows={data?.upcoming || []}
              columns={[
                {
                  key: "MaSoChuyenXe",
                  label: "Chuyến xe",
                  render: (value, row) => (
                    <button
                      className="text-link mono"
                      onClick={() =>
                        navigate("/chuyen-xe?trip=" + encodeURIComponent(value))
                      }
                    >
                      {value}
                      <span className="cell-subtitle">{row.BienSo}</span>
                    </button>
                  ),
                },
                {
                  key: "MaTuyen",
                  label: "Hành trình",
                  render: (value, row) => (
                    <>
                      <strong>{row.DiemCuoi}</strong>
                      <span className="cell-subtitle">
                        Từ {row.DiemDau} · {date(row.NgayThucHien)}
                      </span>
                    </>
                  ),
                },
                { key: "TenLaiXe", label: "Lái chính" },
                {
                  key: "SoKhach",
                  label: "Hành khách",
                  render: (value, row) => (
                    <Badge tone="blue">
                      {value}/{row.SoChoNgoiQuyDinh}
                    </Badge>
                  ),
                },
              ]}
            />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Lịch bảo dưỡng</h2>
              <p>Chủ động chăm sóc đội xe của bạn</p>
            </div>
            <Wrench size={17} className="muted" />
          </div>
          <div className="maintenance-list">
            {data?.maintenance.map((row) => (
              <div className="maintenance-item" key={row.BienSo}>
                <div className="bus-mini">
                  <BusFront size={16} />
                </div>
                <div>
                  <strong>{row.BienSo}</strong>
                  <small>Hạn: {date(row.NgayBaoDuongTiepTheo)}</small>
                </div>
                <Badge
                  tone={
                    row.SoNgayConLai < 0
                      ? "red"
                      : row.SoNgayConLai === 0
                        ? "amber"
                        : "green"
                  }
                >
                  {row.SoNgayConLai < 0
                    ? `Quá ${Math.abs(row.SoNgayConLai)} ngày`
                    : row.SoNgayConLai === 0
                      ? "Hôm nay"
                      : `Còn ${row.SoNgayConLai} ngày`}
                </Badge>
              </div>
            ))}
          </div>
          <div className="panel-bottom">
            <button
              className="text-link"
              onClick={() => navigate("/bao-duong")}
            >
              Quản lý bảo dưỡng <ArrowRight size={12} className="inline" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
