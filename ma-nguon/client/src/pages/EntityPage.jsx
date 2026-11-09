import { useEffect, useState } from "react";
import {
  useOutletContext,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  Copy,
  Eye,
  Map,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { entityDefinitions } from "../lib/entities";
import { api, download, queryString } from "../lib/api";
import { useData, useDebounce } from "../lib/hooks";
import { date } from "../lib/format";
import { useAuth, useToast } from "../lib/context";
import {
  Badge,
  Button,
  ConfirmDialog,
  ExportButton,
  IconButton,
  PageHeading,
  Table,
} from "../components/UI";
import EntityForm from "../components/EntityForm";
import RecordDetail, { QrModal } from "../components/RecordDetail";
import MaintenanceForm from "../components/MaintenanceForm";
export default function EntityPage({ entity }) {
  const { options, reloadOptions, clock } = useOutletContext(),
    { user } = useAuth(),
    toast = useToast(),
    navigate = useNavigate(),
    [searchParams, setSearchParams] = useSearchParams(),
    definition = entityDefinitions[entity];
  const [search, setSearch] = useState(searchParams.get("q") || ""),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState({}),
    [form, setForm] = useState(null),
    [detail, setDetail] = useState(null),
    [deleting, setDeleting] = useState(null),
    [qr, setQr] = useState(null),
    [maintenance, setMaintenance] = useState(null),
    [exporting, setExporting] = useState(false),
    term = useDebounce(search);
  const query = queryString({ q: term, page, limit: 10, ...filters }),
    { data, loading, error, reload } = useData(
      `/api/entities/${entity}?${query}`,
    );
  useEffect(() => {
    setPage(1);
  }, [term, filters]);
  useEffect(() => {
    if (searchParams.get("q") !== null) setSearch(searchParams.get("q"));
    if (searchParams.get("new")) setForm({});
    if (searchParams.get("trip") && entity === "trips")
      setDetail(searchParams.get("trip"));
  }, [searchParams, entity]);
  function closeForm() {
    setForm(null);
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }
  function closeDetail() {
    setDetail(null);
    if (searchParams.has("trip")) {
      const next = new URLSearchParams(searchParams);
      next.delete("trip");
      setSearchParams(next, { replace: true });
    }
  }
  function saved() {
    reload();
    reloadOptions();
  }
  async function exportData() {
    setExporting(true);
    try {
      await download(
        `/api/entities/${entity}/export?${queryString({ q: term, ...filters })}`,
        `${entity}.xlsx`,
      );
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setExporting(false);
    }
  }
  const columns = definition.columns.map((key) => ({
    key,
    ...(key === definition.key
      ? {
          render: (value) => (
            <button className="text-link mono" onClick={() => setDetail(value)}>
              {value}
            </button>
          ),
        }
      : {}),
    ...(key === "MaTuyen" && entity === "trips"
      ? {
          render: (value, row) => (
            <>
              <strong>
                {row.DiemDau} → {row.DiemCuoi}
              </strong>
              <span className="cell-subtitle">{value}</span>
            </>
          ),
        }
      : {}),
    ...(key === "DoPhucTap"
      ? {
          render: (value) => (
            <Badge
              tone={
                Number(value) === 3
                  ? "amber"
                  : Number(value) === 2
                    ? "blue"
                    : "green"
              }
            >
              Cấp {value}
            </Badge>
          ),
        }
      : {}),
    ...(key === "SoKhach"
      ? {
          render: (value, row) => (
            <span>
              {value}
              <span className="muted"> / {row.SoChoNgoiQuyDinh}</span>
            </span>
          ),
        }
      : {}),
    ...(key === "NgayBaoDuongTiepTheo"
      ? {
          render: (value) => (
            <Badge
              tone={
                value < (clock?.today || "")
                  ? "red"
                  : value === clock?.today
                    ? "amber"
                    : "green"
              }
            >
              {date(value)}
            </Badge>
          ),
        }
      : {}),
    ...(key === "Ten"
      ? {
          render: (value, row) => (
            <button className="text-link" onClick={() => setDetail(row.CMT)}>
              {value}
            </button>
          ),
        }
      : {}),
  }));
  const choices =
    entity === "buses"
      ? [
          [
            "HangSanXuat",
            "Tất cả hãng",
            Array.from(
              new Set(options?.buses.map((row) => row.HangSanXuat) || []),
            ).map((value) => [value, value]),
          ],
        ]
      : entity === "drivers"
        ? [
            [
              "LoaiBangLai",
              "Tất cả bằng lái",
              Array.from(
                new Set(options?.drivers.map((row) => row.LoaiBangLai) || []),
              ).map((value) => [value, value]),
            ],
          ]
        : entity === "routes"
          ? [
              [
                "DoPhucTap",
                "Tất cả độ phức tạp",
                [
                  [1, "Cấp 1"],
                  [2, "Cấp 2"],
                  [3, "Cấp 3"],
                ],
              ],
            ]
          : [
              [
                "BienSo",
                "Tất cả xe",
                (options?.buses || []).map((row) => [row.BienSo, row.BienSo]),
              ],
              [
                "MaTuyen",
                "Tất cả tuyến",
                (options?.routes || []).map((row) => [
                  row.MaTuyen,
                  `${row.MaTuyen} · ${row.DiemCuoi}`,
                ]),
              ],
            ];
  return (
    <>
      <PageHeading
        eyebrow="QUẢN LÝ NGHIỆP VỤ"
        title={definition.title}
        description={definition.description}
      >
        <ExportButton onClick={exportData} loading={exporting} />
        {["admin", "operator"].includes(user.VaiTro) && (
          <>
            <Button
              variant="secondary"
              icon={Upload}
              onClick={() => navigate("/du-lieu?entity=" + entity)}
            >
              Nhập tệp
            </Button>
            <Button icon={Plus} onClick={() => setForm({})}>
              Thêm {definition.singular}
            </Button>
          </>
        )}
      </PageHeading>
      <Table
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPage={setPage}
        loading={loading}
        error={error}
        retry={reload}
        search={search}
        onSearch={setSearch}
        searchPlaceholder={`Tìm kiếm ${definition.singular}…`}
        filters={
          <>
            {choices.map(([key, label, items]) => (
              <select
                key={key}
                aria-label={label}
                value={filters[key] || ""}
                onChange={(event) =>
                  setFilters({ ...filters, [key]: event.target.value })
                }
              >
                <option value="">{label}</option>
                {items.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            ))}
            {entity === "trips" && (
              <>
                <input
                  type="date"
                  aria-label="Từ ngày"
                  title="Từ ngày"
                  value={filters.start || ""}
                  onChange={(event) =>
                    setFilters({ ...filters, start: event.target.value })
                  }
                />
                <input
                  type="date"
                  aria-label="Đến ngày"
                  title="Đến ngày"
                  value={filters.end || ""}
                  onChange={(event) =>
                    setFilters({ ...filters, end: event.target.value })
                  }
                />
              </>
            )}
          </>
        }
        rowActions={(row) => (
          <>
            <IconButton
              icon={Eye}
              label="Xem chi tiết"
              onClick={() => setDetail(row[definition.key])}
            />
            {entity === "trips" && (
              <IconButton
                icon={QrCode}
                label="Xem mã QR"
                onClick={() => setQr(row.MaSoChuyenXe)}
              />
            )}
            {entity === "routes" && (
              <IconButton
                icon={Map}
                label="Xem bản đồ"
                onClick={() =>
                  navigate("/ban-do?route=" + encodeURIComponent(row.MaTuyen))
                }
              />
            )}
            {["admin", "operator"].includes(user.VaiTro) && (
              <>
                {entity === "buses" && (
                  <IconButton
                    icon={Wrench}
                    label="Ghi nhận bảo dưỡng"
                    onClick={() => setMaintenance(row)}
                  />
                )}
                {entity === "trips" && (
                  <IconButton
                    icon={Copy}
                    label="Nhân bản chuyến"
                    onClick={() => setForm({ record: row, clone: true })}
                  />
                )}
                <IconButton
                  icon={Pencil}
                  label="Chỉnh sửa"
                  disabled={
                    entity === "trips" &&
                    user.VaiTro !== "admin" &&
                    row.NgayThucHien <= clock?.today
                  }
                  onClick={() => setForm({ record: row })}
                />
                {(user.VaiTro === "admin" || entity === "trips") && (
                  <IconButton
                    icon={Trash2}
                    label={
                      entity === "trips" ? "Xóa / hủy chuyến" : "Xóa bản ghi"
                    }
                    disabled={
                      entity === "trips" &&
                      user.VaiTro !== "admin" &&
                      row.NgayThucHien <= clock?.today
                    }
                    onClick={() => setDeleting(row)}
                  />
                )}
              </>
            )}
          </>
        )}
      />
      {form && (
        <EntityForm
          entity={entity}
          record={form.record}
          clone={form.clone}
          options={options}
          onClose={closeForm}
          onSaved={saved}
        />
      )}
      {detail && (
        <RecordDetail entity={entity} id={detail} onClose={closeDetail} />
      )}
      {qr && <QrModal id={qr} onClose={() => setQr(null)} />}
      {maintenance && (
        <MaintenanceForm
          row={maintenance}
          today={clock?.today}
          onClose={() => setMaintenance(null)}
          onSaved={saved}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={
            entity === "trips" ? "Xóa / hủy chuyến xe?" : "Xóa bản ghi này?"
          }
          description={
            entity === "trips"
              ? `Bạn sắp hủy chuyến ${deleting[definition.key]}. Các đăng ký hành khách của chuyến sẽ bị hủy; xác nhận và lý do hủy vẫn được giữ trong lịch sử. Thao tác được ghi vào nhật ký.`
              : `Bạn sắp xóa ${definition.singular} ${deleting[definition.key]}. Thao tác được ghi vào nhật ký. Các bản ghi đang được tham chiếu sẽ được bảo vệ.`
          }
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(
              `/api/entities/${entity}/${encodeURIComponent(deleting[definition.key])}`,
              { method: "DELETE" },
            );
            toast("Đã xóa bản ghi.");
            saved();
          }}
        />
      )}
    </>
  );
}
