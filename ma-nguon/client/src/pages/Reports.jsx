import { printDocument } from "../lib/native";
import { useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useData } from "../lib/hooks";
import { download, queryString } from "../lib/api";
import { date, money, number, todayLocal } from "../lib/format";
import { useToast } from "../lib/context";
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  PageHeading,
  Table,
  Notice,
} from "../components/UI";
const definitions = {
  salary: {
    label: "Lương tài xế",
    columns: [
      "CMT",
      "Ten",
      "SoChuyenLaiChinh",
      "SoChuyenPhuXe",
      "LuongThangHienTai",
    ],
  },
  revenue: {
    label: "Doanh thu theo xe",
    columns: [
      "NgayBatDau",
      "NgayKetThuc",
      "BienSo",
      "HangSanXuat",
      "Model",
      "SoChuyen",
      "TongSoKhach",
      "DoanhThu",
    ],
  },
  records: { label: "Số bản ghi", columns: ["TenBang", "SoBanGhi"] },
};
export default function Reports() {
  const [type, setType] = useState("salary"),
    today = todayLocal(),
    [range, setRange] = useState({
      start: today.slice(0, 7) + "-01",
      end: today,
    }),
    [applied, setApplied] = useState(range),
    [exporting, setExporting] = useState(false),
    toast = useToast();
  const { data, loading, error, reload } = useData(
    "/api/reports/" + type + "?" + queryString(applied),
  );
  async function exportFile(format = "xlsx") {
    setExporting(true);
    try {
      await download(
        `/api/reports/${type}/export?${queryString({ ...applied, format })}`,
        `bao-cao-${type}.${format}`,
      );
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setExporting(false);
    }
  }
  function apply(event) {
    event.preventDefault();
    if (range.start > range.end) {
      toast("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.", "error");
      return;
    }
    setApplied({ ...range });
    reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="BÁO CÁO THEO YÊU CẦU 2"
        title="Báo cáo hoạt động"
        description="Tra cứu số liệu thực tế từ cơ sở dữ liệu, lựa chọn kỳ báo cáo và xuất kết quả."
      >
        <Button
          variant="secondary"
          icon={Printer}
          onClick={() => printDocument()}
        >
          In / Lưu PDF
        </Button>
        <Button
          variant="secondary"
          icon={Download}
          loading={exporting}
          onClick={() => exportFile("csv")}
        >
          CSV
        </Button>
        <Button
          icon={FileText}
          loading={exporting}
          onClick={() => exportFile()}
        >
          Xuất Excel
        </Button>
      </PageHeading>
      <div className="tabs">
        {Object.entries(definitions).map(([key, value]) => (
          <button
            key={key}
            className={`tab ${key === type ? "active" : ""}`}
            onClick={() => setType(key)}
          >
            {value.label}
          </button>
        ))}
      </div>
      {type === "revenue" && (
        <form className="filters-bar" onSubmit={apply}>
          <Field label="Ngày bắt đầu">
            <input
              type="date"
              required
              value={range.start}
              onChange={(event) =>
                setRange({ ...range, start: event.target.value })
              }
            />
          </Field>
          <Field label="Ngày kết thúc">
            <input
              type="date"
              required
              value={range.end}
              onChange={(event) =>
                setRange({ ...range, end: event.target.value })
              }
            />
          </Field>
          <Button type="submit" icon={CalendarDays} loading={loading}>
            Xem báo cáo
          </Button>
        </form>
      )}
      <div className="table-description">
        <span>
          {definitions[type].label}
          {type !== "records" && ` · ${date(data?.start)} — ${date(data?.end)}`}
        </span>
        <button className="text-link" onClick={reload}>
          <RefreshCw size={11} className="inline mr-1" />
          Làm mới
        </button>
      </div>
      {type === "salary" && (
        <Notice>
          Lương tính từ đầu tháng đến ngày hiện tại. Phụ xe: 100.000đ × hệ số
          tuyến; lái chính hưởng gấp đôi. Hệ số lương cấp 1, 2, 3 lần lượt là
          1,00 · 1,20 · 1,50.
        </Notice>
      )}
      {type === "revenue" && (
        <Notice>
          Bao gồm hai ngày biên, chỉ tính chuyến đã thực hiện đến hôm nay. Xe
          không có chuyến trong khoảng vẫn được hiển thị với doanh thu 0.
        </Notice>
      )}
      <Table
        columns={definitions[type].columns.map((key) => ({
          key,
          ...(key === "TenBang"
            ? {
                render: (value) => (
                  <Badge tone={value === "TONG_CONG" ? "indigo" : "slate"}>
                    {value === "TONG_CONG" ? "TỔNG CỘNG" : value}
                  </Badge>
                ),
              }
            : {}),
        }))}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        retry={reload}
      />
    </>
  );
}
