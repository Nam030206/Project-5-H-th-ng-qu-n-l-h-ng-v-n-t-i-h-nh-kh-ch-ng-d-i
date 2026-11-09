import { printDocument } from "../lib/native";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer, QrCode } from "lucide-react";
import { useData } from "../lib/hooks";
import { entityDefinitions } from "../lib/entities";
import { Badge, Button, DetailsGrid, ErrorBox, Modal, Table } from "./UI";
export function QrModal({ id, onClose }) {
  const [image, setImage] = useState(""),
    [error, setError] = useState(null),
    url = window.desktop
      ? `vanhanh://trip/${encodeURIComponent(id)}`
      : `${window.location.origin}${window.location.pathname}#/chuyen-xe?trip=${encodeURIComponent(id)}`;
  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 450,
      margin: 2,
      color: { dark: "#17213aff", light: "#ffffffff" },
    })
      .then(setImage)
      .catch(setError);
  }, [url]);
  return (
    <Modal
      title={`Mã QR · ${id}`}
      description="Quét mã để mở chuyến xe. Người sử dụng cần đăng nhập vào hệ thống."
      onClose={onClose}
    >
      <ErrorBox error={error} />
      {image && (
        <img className="qr-image" src={image} alt={`Mã QR chuyến ${id}`} />
      )}
      <p className="muted text-center text-xs">{id}</p>
      <div className="form-footer">
        <Button
          variant="secondary"
          icon={Printer}
          onClick={() => printDocument()}
        >
          In mã
        </Button>
        <a
          className="btn btn-primary"
          href={image || undefined}
          download={`${id}-qr.png`}
          aria-disabled={!image}
        >
          <Download size={16} />
          Tải PNG
        </a>
      </div>
    </Modal>
  );
}
export default function RecordDetail({ entity, id, onClose }) {
  const { data, loading, error, reload } = useData(
      `/api/entities/${entity}/${encodeURIComponent(id)}`,
      { poll: false },
    ),
    [qr, setQr] = useState(false),
    definition = entityDefinitions[entity];
  return (
    <Modal
      title={`Chi tiết ${definition.singular}`}
      description={id}
      onClose={onClose}
      wide
    >
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? (
        <p className="muted">Đang tải thông tin…</p>
      ) : (
        data && (
          <>
            <DetailsGrid record={data.record} />
            {entity !== "trips" && (
              <>
                <h3 className="detail-section">
                  {entity === "drivers"
                    ? "Lịch sử tham gia chuyến"
                    : "Lịch sử chuyến xe"}{" "}
                  <Badge>{data.history.length} chuyến</Badge>
                </h3>
                <Table
                  rows={data.history}
                  columns={[
                    { key: "MaSoChuyenXe" },
                    { key: "NgayThucHien" },
                    { key: "BienSo" },
                    {
                      key: "MaTuyen",
                      label: "Hành trình",
                      render: (_value, row) =>
                        `${row.DiemDau} → ${row.DiemCuoi}`,
                    },
                    { key: "TenLaiXe" },
                    { key: "TenPhuXe" },
                    ...(entity === "drivers"
                      ? [
                          {
                            key: "CMTLaiXe",
                            label: "Vai trò",
                            render: (value) => (
                              <Badge tone={value === id ? "indigo" : "blue"}>
                                {value === id ? "Lái chính" : "Phụ xe"}
                              </Badge>
                            ),
                          },
                        ]
                      : []),
                    { key: "SoKhach" },
                  ]}
                />
                {data.history.length === 2000 && (
                  <p className="muted text-xs mt-3">
                    Hiển thị tối đa 2.000 chuyến gần nhất.
                  </p>
                )}
              </>
            )}
            <div className="form-footer">
              <Button
                variant="secondary"
                icon={Printer}
                onClick={() => printDocument()}
              >
                In / Lưu PDF
              </Button>
              {entity === "trips" && (
                <Button icon={QrCode} onClick={() => setQr(true)}>
                  Mã QR chuyến
                </Button>
              )}
            </div>
          </>
        )
      )}
      {qr && <QrModal id={id} onClose={() => setQr(false)} />}
    </Modal>
  );
}
