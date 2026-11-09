import { useState } from "react";
import { Eye } from "lucide-react";
import { useData, useDebounce } from "../lib/hooks";
import { queryString } from "../lib/api";
import { dateTime, displayValue, fieldLabels } from "../lib/format";
import { Badge, IconButton, Modal, PageHeading, Table } from "../components/UI";
const actions = {
  CREATE: "Thêm mới",
  UPDATE: "Chỉnh sửa",
  DELETE: "Xóa",
  IMPORT: "Nhập tệp",
  BACKUP: "Sao lưu",
  RESTORE: "Phục hồi",
  LOGIN: "Đăng nhập",
  REGISTER: "Tự đăng ký",
  BOOK: "Đăng ký chuyến",
  CANCEL_BOOKING: "Hủy đăng ký",
  CANCEL_TRIP_BOOKING: "Hủy đăng ký theo chuyến",
  SETUP: "Thiết lập",
  MAINTENANCE: "Bảo dưỡng",
};
function object(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { NoiDung: value };
  }
}
export default function Audit() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    term = useDebounce(search),
    { data, loading, error, reload } = useData(
      "/api/audit?" + queryString({ q: term, page, limit: 10 }),
    );
  const before = object(detail?.TruocKhiSua),
    after = object(detail?.SauKhiSua),
    changes = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).map((key) => ({ field: key, before: before[key], after: after[key] }));
  return (
    <>
      <PageHeading
        eyebrow="MINH BẠCH DỮ LIỆU"
        title="Nhật ký thao tác"
        description="Theo dõi người thực hiện, thời điểm và nội dung thay đổi trong hệ thống."
      />
      <Table
        columns={[
          { key: "ThoiDiem", label: "Thời điểm", render: dateTime },
          { key: "NguoiThucHien", label: "Người thực hiện" },
          {
            key: "HanhDong",
            label: "Thao tác",
            render: (value) => (
              <Badge
                tone={
                  value === "DELETE"
                    ? "red"
                    : value === "CREATE"
                      ? "green"
                      : "indigo"
                }
              >
                {actions[value] || value}
              </Badge>
            ),
          },
          { key: "DoiTuong", label: "Đối tượng" },
          { key: "MaBanGhi", label: "Mã bản ghi" },
        ]}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPage={setPage}
        loading={loading}
        error={error}
        retry={reload}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        rowActions={(row) => (
          <IconButton
            icon={Eye}
            label="Xem nội dung thay đổi"
            onClick={() => setDetail(row)}
          />
        )}
      />
      {detail && (
        <Modal
          title="Chi tiết thao tác"
          description={`${detail.NguoiThucHien} · ${dateTime(detail.ThoiDiem)} · ${actions[detail.HanhDong] || detail.HanhDong}`}
          onClose={() => setDetail(null)}
          wide
        >
          <Table
            columns={[
              {
                key: "field",
                label: "Thông tin",
                render: (value) => fieldLabels[value] || value,
              },
              {
                key: "before",
                label: "Trước thay đổi",
                render: (value, row) => displayValue(row.field, value),
              },
              {
                key: "after",
                label: "Sau thay đổi",
                render: (value, row) => displayValue(row.field, value),
              },
            ]}
            rows={changes}
            empty="Thao tác này không có nội dung thay đổi chi tiết."
          />
        </Modal>
      )}
    </>
  );
}
