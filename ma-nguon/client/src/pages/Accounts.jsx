import { useState } from "react";
import { Pencil, Plus, Save, ShieldCheck } from "lucide-react";
import { useData, useDebounce } from "../lib/hooks";
import { api, queryString } from "../lib/api";
import { useToast } from "../lib/context";
import { roleLabels } from "../lib/format";
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
function AccountForm({ record, onClose, onSaved }) {
  const [values, setValues] = useState({
      TenDangNhap: record?.TenDangNhap || "",
      HoTen: record?.HoTen || "",
      VaiTro: record?.VaiTro || "passenger",
      HoatDong: record ? !!record.HoatDong : true,
      MatKhau: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...values };
      if (record && !body.MatKhau) delete body.MatKhau;
      await api("/api/accounts" + (record ? "/" + record.Id : ""), {
        method: record ? "PUT" : "POST",
        body,
      });
      toast("Đã lưu tài khoản.");
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
      title={record ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}
      description="Quyền truy cập được kiểm tra ở cả giao diện và máy chủ."
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Họ và tên">
            <input
              required
              maxLength={100}
              value={values.HoTen}
              onChange={(event) =>
                setValues({ ...values, HoTen: event.target.value })
              }
            />
          </Field>
          <Field label="Tên đăng nhập">
            <input
              required
              pattern="[a-zA-Z0-9_.\-]{3,50}"
              title="3–50 chữ, số hoặc dấu _ . -"
              value={values.TenDangNhap}
              onChange={(event) =>
                setValues({ ...values, TenDangNhap: event.target.value })
              }
            />
          </Field>
          <Field label="Vai trò">
            <select
              value={values.VaiTro}
              onChange={(event) =>
                setValues({ ...values, VaiTro: event.target.value })
              }
            >
              {Object.entries(roleLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={record ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu"}
            hint={
              record
                ? "Để trống để giữ mật khẩu hiện tại."
                : "Tối thiểu 8 ký tự."
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              required={!record}
              minLength={8}
              maxLength={72}
              value={values.MatKhau}
              onChange={(event) =>
                setValues({ ...values, MatKhau: event.target.value })
              }
            />
          </Field>
          <label className="field-span flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={values.HoatDong}
              onChange={(event) =>
                setValues({ ...values, HoatDong: event.target.checked })
              }
            />
            Cho phép tài khoản hoạt động
          </label>
        </div>
        <ErrorBox error={error} />
        <div className="form-footer">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" icon={Save} loading={busy}>
            Lưu tài khoản
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function Accounts() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    term = useDebounce(search),
    { data, loading, error, reload } = useData(
      "/api/accounts?" + queryString({ q: term, page, limit: 10 }),
    );
  return (
    <>
      <PageHeading
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tài khoản & phân quyền"
        description="Quản lý người sử dụng và cấp đúng quyền cho từng vai trò."
      >
        <Button icon={Plus} onClick={() => setEditing({})}>
          Thêm tài khoản
        </Button>
      </PageHeading>
      <Table
        columns={[
          { key: "HoTen", label: "Họ và tên" },
          { key: "TenDangNhap", label: "Tên đăng nhập" },
          {
            key: "VaiTro",
            label: "Vai trò",
            render: (value) => (
              <Badge
                tone={
                  value === "admin"
                    ? "indigo"
                    : value === "operator"
                      ? "blue"
                      : "slate"
                }
              >
                {roleLabels[value]}
              </Badge>
            ),
          },
          {
            key: "HoatDong",
            label: "Trạng thái",
            render: (value) => (
              <Badge tone={value ? "green" : "red"}>
                {value ? "Đang hoạt động" : "Đã khóa"}
              </Badge>
            ),
          },
          { key: "NgayTao", label: "Ngày tạo" },
        ]}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        retry={reload}
        total={data?.total || 0}
        page={page}
        onPage={setPage}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        rowActions={(row) => (
          <IconButton
            icon={Pencil}
            label="Chỉnh sửa tài khoản"
            onClick={() => setEditing({ record: row })}
          />
        )}
      />
      {editing && (
        <AccountForm
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
