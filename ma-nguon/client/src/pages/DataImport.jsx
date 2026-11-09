import { useState } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { entityDefinitions } from "../lib/entities";
import { fieldLabels } from "../lib/format";
import { api, saveBlob } from "../lib/api";
import { useToast } from "../lib/context";
import { Button, ErrorBox, Field, Notice, PageHeading } from "../components/UI";
export default function DataImport() {
  const [parameters] = useSearchParams(),
    [entity, setEntity] = useState(
      Object.hasOwn(entityDefinitions, parameters.get("entity"))
        ? parameters.get("entity")
        : "buses",
    ),
    [file, setFile] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    toast = useToast(),
    { reloadOptions } = useOutletContext();
  function template() {
    const header = entityDefinitions[entity].fields
      .map(([key]) => fieldLabels[key])
      .join(",");
    saveBlob(
      new Blob(["\uFEFF" + header + "\r\n"], {
        type: "text/csv;charset=utf-8",
      }),
      `mau-${entity}.csv`,
    );
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await api("/api/entities/" + entity + "/import", {
        method: "POST",
        body: form,
      });
      setResult(data);
      toast(`Đã nhập ${data.imported} bản ghi.`);
      reloadOptions();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DỮ LIỆU TẬP TRUNG"
        title="Nhập dữ liệu"
        description="Thêm nhiều bản ghi từ Excel hoặc CSV, kiểm tra ràng buộc trước khi lưu vào hệ thống."
      />
      <div className="utility-grid">
        <section className="utility-card">
          <div className="utility-icon">
            <FileSpreadsheet size={24} />
          </div>
          <h2>Nhập từ tệp</h2>
          <p>
            Sử dụng biểu mẫu đúng loại dữ liệu. Toàn bộ lần nhập sẽ được hoàn
            tác nếu có một dòng không hợp lệ.
          </p>
          <form onSubmit={submit}>
            <Field label="Loại dữ liệu">
              <select
                value={entity}
                onChange={(event) => {
                  setEntity(event.target.value);
                  setResult(null);
                  setError(null);
                }}
              >
                {Object.entries(entityDefinitions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="file-drop">
              <Upload size={27} />
              <p>Chọn tệp Excel (.xlsx) hoặc CSV (.csv)</p>
              <p className="text-xs mt-1">
                Tối đa 5 MB · 2.000 dòng mỗi lần nhập
              </p>
              <input
                type="file"
                required
                accept=".xlsx,.csv"
                aria-label="Chọn tệp nhập dữ liệu"
                onChange={(event) => {
                  setFile(event.target.files[0] || null);
                  setResult(null);
                  setError(null);
                }}
              />
            </div>
            <ErrorBox error={error} />
            {result && (
              <div className="notice">
                <CheckCircle2 size={18} />
                <span>Đã nhập thành công {result.imported} bản ghi.</span>
              </div>
            )}
            <Button type="submit" icon={Upload} loading={busy} disabled={!file}>
              Kiểm tra & nhập dữ liệu
            </Button>
          </form>
        </section>
        <section className="utility-card">
          <div className="utility-icon">
            <Download size={24} />
          </div>
          <h2>Chuẩn bị tệp đúng cách</h2>
          <p>
            Tải tệp mẫu, mở bằng Excel và điền dữ liệu từ dòng thứ hai. Có thể
            lưu thành CSV UTF-8 hoặc Excel .xlsx.
          </p>
          <Button variant="secondary" icon={Download} onClick={template}>
            Tải mẫu {entityDefinitions[entity].singular}
          </Button>
          <Notice>
            Các cột trong mẫu:{" "}
            {entityDefinitions[entity].fields
              .map(([key]) => fieldLabels[key])
              .join(", ")}
            .
          </Notice>
          <ul className="text-xs muted leading-7 list-disc pl-5">
            <li>
              Giữ CMT, biển số và các mã ở dạng văn bản để không mất số 0 đầu.
            </li>
            <li>Ngày tháng dùng dạng YYYY-MM-DD hoặc ô ngày của Excel.</li>
            <li>Nhập xe, tài xế và tuyến trước khi nhập chuyến xe.</li>
            <li>
              Mã đã tồn tại sẽ bị báo trùng; thao tác này chỉ thêm bản ghi mới.
            </li>
            <li>Lương, doanh thu và hạn bảo dưỡng được hệ thống tự tính.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
