import { printDocument } from "../lib/native";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  BusFront,
  CalendarCheck,
  Clock3,
  Download,
  Printer,
  Wrench,
} from "lucide-react";
import { useData } from "../lib/hooks";
import { download } from "../lib/api";
import { useAuth, useToast } from "../lib/context";
import {
  Badge,
  Button,
  IconButton,
  Notice,
  PageHeading,
  StatCard,
  Table,
} from "../components/UI";
import MaintenanceForm from "../components/MaintenanceForm";
export default function Maintenance() {
  const { data, loading, error, reload } = useData("/api/reports/maintenance"),
    { user } = useAuth(),
    { reloadOptions } = useOutletContext(),
    [tab, setTab] = useState("all"),
    [selected, setSelected] = useState(null),
    toast = useToast();
  const rows = data?.rows || [],
    overdue = rows.filter((row) => Number(row.SoNgayConLai) < 0),
    due = rows.filter((row) => Number(row.SoNgayConLai) === 0),
    soon = rows.filter(
      (row) => Number(row.SoNgayConLai) > 0 && Number(row.SoNgayConLai) <= 7,
    ),
    visible = tab === "overdue" ? overdue : tab === "today" ? due : rows;
  async function exportData() {
    try {
      await download("/api/reports/maintenance/export", "bao-duong.xlsx");
    } catch (error) {
      toast(error.message, "error");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CHĂM SÓC ĐỘI XE"
        title="Quản lý bảo dưỡng"
        description="Theo dõi hạn bảo dưỡng, phát hiện xe quá hạn và ghi nhận những lần bảo dưỡng mới."
      >
        <Button
          variant="secondary"
          icon={Printer}
          onClick={() => printDocument()}
        >
          In / Lưu PDF
        </Button>
        <Button icon={Download} onClick={exportData}>
          Xuất Excel
        </Button>
      </PageHeading>
      <div className="stats-grid">
        <StatCard
          label="Xe đang quản lý"
          value={rows.length}
          description="Toàn bộ đội xe"
          icon={BusFront}
        />
        <StatCard
          label="Đã quá hạn"
          value={overdue.length}
          description="Cần sắp xếp bảo dưỡng"
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          label="Đến hạn hôm nay"
          value={due.length}
          description="Theo hạn đã tính"
          icon={CalendarCheck}
          tone="blue"
        />
        <StatCard
          label="Đến hạn trong 7 ngày"
          value={soon.length}
          description="Chủ động lập kế hoạch"
          icon={Clock3}
          tone="green"
        />
      </div>
      <div className="tabs">
        <button
          className={`tab ${tab === "all" ? "active" : ""}`}
          onClick={() => setTab("all")}
        >
          Tất cả xe ({rows.length})
        </button>
        <button
          className={`tab ${tab === "overdue" ? "active" : ""}`}
          onClick={() => setTab("overdue")}
        >
          Danh sách quá hạn ({overdue.length})
        </button>
        <button
          className={`tab ${tab === "today" ? "active" : ""}`}
          onClick={() => setTab("today")}
        >
          Đến hạn hôm nay ({due.length})
        </button>
      </div>
      <Table
        columns={[
          {
            key: "BienSo",
            render: (value) => <strong className="mono">{value}</strong>,
          },
          { key: "NgayBaoDuongCuoiCung" },
          { key: "TongKmLamViec" },
          { key: "SoNgayGiam" },
          { key: "NgayBaoDuongTiepTheo" },
          {
            key: "SoNgayConLai",
            render: (value) =>
              Number(value) < 0
                ? `Quá ${Math.abs(Number(value))} ngày`
                : Number(value) === 0
                  ? "Hôm nay"
                  : `Còn ${value} ngày`,
          },
          {
            key: "TrangThaiBaoDuong",
            render: (value, row) => (
              <Badge
                tone={
                  Number(row.SoNgayConLai) < 0
                    ? "red"
                    : Number(row.SoNgayConLai) === 0
                      ? "amber"
                      : "green"
                }
              >
                {value}
              </Badge>
            ),
          },
        ]}
        rows={visible}
        loading={loading}
        error={error}
        retry={reload}
        rowActions={
          ["admin", "operator"].includes(user.VaiTro)
            ? (row) => (
                <Button
                  variant="secondary"
                  icon={Wrench}
                  onClick={() => setSelected(row)}
                >
                  Đã bảo dưỡng
                </Button>
              )
            : undefined
        }
      />
      <Notice>
        Chu kỳ tối đa 360 ngày; mỗi 100 km làm việc giảm 1 ngày. Km làm việc =
        độ dài tuyến × hệ số đường khó (1,00 · 1,30 · 1,60). Hệ thống cộng km từ
        lần bảo dưỡng gần nhất đến hôm nay rồi mới làm tròn xuống.
      </Notice>
      {selected && (
        <MaintenanceForm
          row={selected}
          today={data?.clock.today}
          onClose={() => setSelected(null)}
          onSaved={() => {
            reload();
            reloadOptions();
          }}
        />
      )}
    </>
  );
}
