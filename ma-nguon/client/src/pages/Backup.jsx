import { useState } from "react";
import { DatabaseBackup, Download, RotateCcw, Upload } from "lucide-react";
import { api, download } from "../lib/api";
import { dateTime } from "../lib/format";
import { entityDefinitions } from "../lib/entities";
import { useToast } from "../lib/context";
import {
  Button,
  ErrorBox,
  Field,
  Notice,
  PageHeading,
  Table,
} from "../components/UI";
export default function Backup() {
  const [backupPassword, setBackupPassword] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(null),
    toast = useToast();
  async function exportData(event) {
    event.preventDefault();
    setBusy("backup");
    setError(null);
    try {
      await download(
        "/api/backups/export",
        `vanhanh-backup-${new Date().toISOString().slice(0, 10)}.json`,
        { method: "POST", body: { password: backupPassword } },
      );
      setBackupPassword("");
      toast("Đã tải bản sao lưu dữ liệu.");
    } catch (error) {
      setError(error);
    } finally {
      setBusy("");
    }
  }
  async function inspect() {
    if (!file) return;
    setBusy("preview");
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      setPreview(
        await api("/api/backups/preview", { method: "POST", body: form }),
      );
    } catch (error) {
      setPreview(null);
      setError(error);
    } finally {
      setBusy("");
    }
  }
  async function restore(event) {
    event.preventDefault();
    if (!file || !preview) return;
    setBusy("restore");
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("password", password);
    form.append("confirmation", confirmation);
    try {
      await api("/api/backups/restore", { method: "POST", body: form });
      toast("Đã phục hồi dữ liệu và tính lại lương, bảo dưỡng.");
      setPreview(null);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setError(error);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BẢO TOÀN DỮ LIỆU"
        title="Sao lưu & phục hồi"
        description="Lưu bản sao của bốn bảng nghiệp vụ và phục hồi khi cần thiết."
      />
      <ErrorBox error={error} />
      <div className="utility-grid">
        <section className="utility-card">
          <div className="utility-icon">
            <DatabaseBackup size={24} />
          </div>
          <h2>Tạo bản sao lưu</h2>
          <p>
            Tải dữ liệu xe, tài xế, tuyến và chuyến dưới dạng JSON có mã kiểm
            tra toàn vẹn. Tài khoản và nhật ký được quản lý riêng.
          </p>
          <form onSubmit={exportData}>
            <Field label="Xác nhận mật khẩu quản trị">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={backupPassword}
                onChange={(event) => setBackupPassword(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              icon={Download}
              loading={busy === "backup"}
              disabled={!!busy && busy !== "backup"}
              className="mt-5"
            >
              Tải bản sao lưu
            </Button>
          </form>
        </section>
        <section className="utility-card">
          <div className="utility-icon">
            <RotateCcw size={24} />
          </div>
          <h2>Phục hồi từ bản sao lưu</h2>
          <p>
            Kiểm tra tệp trước khi xác nhận thay thế dữ liệu nghiệp vụ. Tài
            khoản và nhật ký hiện tại được giữ nguyên.
          </p>
          <div className="file-drop">
            <Upload size={25} />
            <p>Chọn bản sao lưu do Vận Hành tạo</p>
            <input
              type="file"
              accept=".json"
              aria-label="Chọn tệp sao lưu"
              onChange={(event) => {
                setFile(event.target.files[0] || null);
                setPreview(null);
                setConfirmation("");
              }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={inspect}
            loading={busy === "preview"}
            disabled={!file || !!busy}
          >
            Kiểm tra tệp
          </Button>
          {preview && (
            <>
              <Notice>
                Bản sao lưu tạo lúc {dateTime(preview.createdAt)}. Dữ liệu hiện
                có trong bốn bảng sẽ được thay thế sau khi xác nhận.
              </Notice>
              <Table
                columns={[
                  { key: "table", label: "Dữ liệu" },
                  { key: "count", label: "Số bản ghi" },
                ]}
                rows={Object.entries(preview.counts).map(([key, count]) => ({
                  table: entityDefinitions[key].title,
                  count,
                }))}
              />
              <form onSubmit={restore}>
                <Field label="Mật khẩu quản trị">
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                <Field label="Nhập PHUC HOI để xác nhận thay thế dữ liệu">
                  <input
                    required
                    pattern="PHUC HOI"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="PHUC HOI"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="danger"
                  icon={RotateCcw}
                  loading={busy === "restore"}
                  disabled={!!busy && busy !== "restore"}
                  className="mt-5"
                >
                  Phục hồi & thay thế dữ liệu
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
