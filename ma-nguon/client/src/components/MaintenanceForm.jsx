import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "../lib/api";
import { todayLocal } from "../lib/format";
import { useToast } from "../lib/context";
import { Button, ErrorBox, Field, Modal, Notice } from "./UI";
export default function MaintenanceForm({ row, today, onClose, onSaved }) {
  const [date, setDate] = useState(today || todayLocal()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/maintenance/" + encodeURIComponent(row.BienSo), {
        method: "POST",
        body: { date },
      });
      toast("Đã ghi nhận bảo dưỡng và tính lại hạn tiếp theo.");
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
      title="Ghi nhận đã bảo dưỡng"
      description={`Xe ${row.BienSo}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <Field label="Ngày thực tế đã bảo dưỡng">
          <input
            type="date"
            required
            value={date}
            max={today || todayLocal()}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Notice>
          Ngày này trở thành mốc bắt đầu chu kỳ bảo dưỡng mới. Các chuyến từ mốc
          này đến hiện tại được tính vào chu kỳ.
        </Notice>
        <ErrorBox error={error} />
        <div className="form-footer">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" icon={Save} loading={busy}>
            Xác nhận bảo dưỡng
          </Button>
        </div>
      </form>
    </Modal>
  );
}
