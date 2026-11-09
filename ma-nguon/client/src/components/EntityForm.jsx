import { useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { entityDefinitions, editableValues, newTripId } from "../lib/entities";
import { fieldLabels, money, todayLocal, tripRevenue } from "../lib/format";
import { api } from "../lib/api";
import { useToast } from "../lib/context";
import { Button, ErrorBox, Field, Modal, Notice } from "./UI";
export default function EntityForm({
  entity,
  record,
  clone = false,
  options,
  onClose,
  onSaved,
}) {
  const definition = entityDefinitions[entity],
    editing = !!record && !clone,
    toast = useToast();
  const [values, setValues] = useState(() => {
      const initial = editableValues(entity, record);
      if (entity === "trips" && !editing) {
        initial.MaSoChuyenXe = newTripId();
        initial.NgayThucHien = options?.clock.today || todayLocal();
        if (clone) initial.SoKhach = 0;
      }
      if (entity === "buses" && !editing)
        initial.NgayBaoDuongCuoiCung = options?.clock.today || todayLocal();
      return initial;
    }),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const bus = options?.buses.find((row) => row.BienSo === values.BienSo),
    passengers = Number(values.SoKhach || 0),
    capacityError =
      entity === "trips" && bus && passengers > Number(bus.SoChoNgoiQuyDinh),
    roleError =
      entity === "trips" &&
      values.CMTLaiXe &&
      values.CMTLaiXe === values.CMTPhuXe;
  const set = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (capacityError || roleError) return;
    setBusy(true);
    setError(null);
    try {
      await api(
        `/api/entities/${entity}${editing ? "/" + encodeURIComponent(record[definition.key]) : ""}`,
        { method: editing ? "PUT" : "POST", body: values },
      );
      toast(editing ? "Đã lưu thay đổi." : "Đã thêm bản ghi thành công.");
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
      title={`${clone ? "Nhân bản" : editing ? "Chỉnh sửa" : "Thêm"} ${definition.singular}`}
      description={
        clone
          ? "Kiểm tra nhân sự, chọn ngày thực hiện và nhập số khách cho chuyến mới."
          : "Thông tin có dấu * là bắt buộc."
      }
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {definition.fields.map(([key, type, max, min, step]) => {
            const fieldError = error?.details?.find(
              (item) => item.field === key,
            )?.message;
            let control;
            if (["difficulty", "bus", "route", "driver"].includes(type)) {
              let items = [];
              if (type === "difficulty")
                items = [1, 2, 3].map((value) => ({
                  value,
                  label: `Cấp ${value}`,
                }));
              if (type === "bus")
                items = (options?.buses || []).map((row) => ({
                  value: row.BienSo,
                  label: `${row.BienSo} · ${row.SoChoNgoiQuyDinh} chỗ khách`,
                  disabled: passengers > Number(row.SoChoNgoiQuyDinh),
                }));
              if (type === "route")
                items = (options?.routes || []).map((row) => ({
                  value: row.MaTuyen,
                  label: `${row.MaTuyen} · ${row.DiemDau} → ${row.DiemCuoi}`,
                }));
              if (type === "driver")
                items = (options?.drivers || []).map((row) => ({
                  value: row.CMT,
                  label: `${row.Ten} · ${row.CMT}`,
                  disabled:
                    row.CMT ===
                    (key === "CMTLaiXe" ? values.CMTPhuXe : values.CMTLaiXe),
                }));
              control = (
                <select
                  required
                  value={values[key]}
                  onChange={(event) => set(key, event.target.value)}
                >
                  <option value="">
                    Chọn {fieldLabels[key].toLowerCase()}
                  </option>
                  {items.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                      disabled={item.disabled}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              );
            } else
              control = (
                <input
                  type={type}
                  required
                  maxLength={type === "text" ? max : undefined}
                  max={type === "number" ? max : undefined}
                  min={type === "number" ? min : undefined}
                  step={type === "number" ? step || 1 : undefined}
                  disabled={editing && key === definition.key}
                  value={values[key]}
                  onChange={(event) => set(key, event.target.value)}
                  autoFocus={key === definition.fields[0][0]}
                />
              );
            return (
              <Field
                key={key}
                label={`${fieldLabels[key]} *`}
                error={fieldError}
                span={key === "DiaChi"}
                hint={
                  key === definition.key && editing
                    ? "Mã định danh được giữ nguyên."
                    : key === "BienSo" && entity === "trips"
                      ? "Xe không đủ chỗ sẽ không thể chọn."
                      : key === "SoKhach" && entity === "trips"
                        ? "Tổng số khách, gồm cả chỗ đã đăng ký qua ứng dụng."
                        : key === "DoPhucTap"
                          ? "Cấp 1, 2, 3 có hệ số lương 1,00 · 1,20 · 1,50."
                          : undefined
                }
              >
                {control}
              </Field>
            );
          })}
        </div>
        {entity === "trips" && (
          <>
            <div className="form-summary">
              <span>Doanh thu dự kiến theo số khách</span>
              <strong>
                {money(tripRevenue(values.SoKhach, values.GiaVe))}
              </strong>
            </div>
            {bus && (
              <Notice>
                Xe {bus.BienSo} có {bus.SoGhe} ghế, được phép chở tối đa{" "}
                {bus.SoChoNgoiQuyDinh} khách.
              </Notice>
            )}
            {capacityError && (
              <ErrorBox
                error={{
                  message:
                    "Số khách vượt quá số chỗ được phép chở của xe đã chọn.",
                }}
              />
            )}
            {roleError && (
              <ErrorBox
                error={{
                  message: "Lái chính và phụ xe phải là hai người khác nhau.",
                }}
              />
            )}
          </>
        )}
        <ErrorBox error={error} />
        <div className="form-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            type="submit"
            icon={Save}
            loading={busy}
            disabled={!!capacityError || !!roleError}
          >
            Lưu thông tin
          </Button>
        </div>
      </form>
    </Modal>
  );
}
