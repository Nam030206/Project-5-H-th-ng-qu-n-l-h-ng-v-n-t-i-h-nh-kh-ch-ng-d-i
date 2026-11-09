import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import L from "leaflet";
import { ExternalLink, Map, Navigation, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  Notice,
  PageHeading,
} from "../components/UI";
function MapView({ locations }) {
  const element = useRef();
  const [tileError, setTileError] = useState(false);
  const [reload, setReload] = useState(0);
  const provider = "osm";
  const [diagnostic, setDiagnostic] = useState(null);
  useEffect(() => {
    setTileError(false);
    setDiagnostic(null);
    const map = L.map(element.current, { scrollWheelZoom: false }),
      start = [locations.start.lat, locations.start.lng],
      end = [locations.end.lat, locations.end.lng];
    let active = true, loaded = false, checking = false, failed = false;
    async function reportFailure() {
      if (!active) return;
      setTileError(true);
      if (checking) return;
      checking = true;
      try {
        const info = await api("/api/maps/status/" + provider);
        if (active && info.ok === false) setDiagnostic(info);
      } catch { /* Thông báo tải ảnh nền vẫn hiển thị khi mất kết nối nội bộ. */ }
    }
    const tiles = L.tileLayer(`/api/maps/tiles/${provider}/{z}/{x}/{y}.png`, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    tiles.on("tileload", () => { loaded = true; });
    tiles.on("tileerror", () => { failed = true; reportFailure(); });
    tiles.on("load", () => {
      if (active && !failed) { setTileError(false); setDiagnostic(null); }
    });
    tiles.addTo(map);
    [locations.start, locations.end].forEach((point, index) => {
      const label = document.createElement("span");
      label.textContent = point.label;
      L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "map-marker",
          html: `<span style="display:grid;place-items:center;background:${index ? "#20a47b" : "#6256e5"};color:white;width:30px;height:30px;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #1114;font-weight:700">${index ? "B" : "A"}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      })
        .addTo(map)
        .bindTooltip(label);
    });
    L.polyline([start, end], {
      color: "#6f63e7",
      weight: 3,
      dashArray: "8 8",
    }).addTo(map);
    map.fitBounds(L.latLngBounds([start, end]), {
      padding: [45, 45],
      maxZoom: 12,
    });
    const timer = setTimeout(() => map.invalidateSize(), 100);
    const deadline = setTimeout(() => {
      if (active && !loaded) reportFailure();
    }, 18000);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element.current);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(deadline);
      observer.disconnect();
      tiles.off();
      map.remove();
    };
  }, [locations, reload, provider]);
  return (
    <>
      <div className="map-source-bar">
        <strong>OpenStreetMap</strong>
        <span className="muted">Bản đồ 1.3.5</span>
      </div>
      {tileError && (
        <div className="map-tile-warning" role="status">
          <div>
            <p>{diagnostic?.message || "Chưa tải được đầy đủ ảnh nền OpenStreetMap. Hãy kiểm tra kết nối rồi tải lại ảnh nền."}</p>
            {diagnostic?.code && <small className="muted">Mã kết nối: {diagnostic.code}{diagnostic.nativeCode ? ` / ${diagnostic.nativeCode}` : ""} · {diagnostic.name}</small>}
          </div>
          <div className="map-retry-actions">
            <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>Tải lại ảnh nền</Button>
          </div>
        </div>
      )}
      <div
        className="map-container"
        ref={element}
        aria-label="Bản đồ điểm đầu và điểm cuối tuyến"
      />
    </>
  );
}
export default function RouteMap() {
  const { options } = useOutletContext(),
    request = useRef(null),
    [parameters] = useSearchParams(),
    [id, setId] = useState(parameters.get("route") || ""),
    [locations, setLocations] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    route = options?.routes.find((row) => row.MaTuyen === id);
  useEffect(() => () => request.current?.abort(), []);
  async function load(event) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setLocations(null);
    try {
      const result = await api("/api/maps/" + encodeURIComponent(id), { signal: controller.signal });
      if (!controller.signal.aborted) setLocations(result);
    } catch (error) {
      if (!controller.signal.aborted) setError(error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="KẾT NỐI ĐIỂM ĐẾN"
        title="Bản đồ tuyến đường"
        description="Xem vị trí hai đầu tuyến và mở chỉ đường cho hành trình."
      />
      <form className="filters-bar" onSubmit={load}>
        <Field label="Tuyến đường">
          <select
            required
            value={id}
            onChange={(event) => {
              request.current?.abort();
              setBusy(false);
              setId(event.target.value);
              setLocations(null);
              setError(null);
            }}
          >
            <option value="">Chọn một tuyến</option>
            {options?.routes.map((row) => (
              <option key={row.MaTuyen} value={row.MaTuyen}>
                {row.MaTuyen} · {row.DiemDau} → {row.DiemCuoi}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" icon={Map} loading={busy} disabled={!id}>
          Tải bản đồ
        </Button>
        {route && (
          <div className="flex gap-2 pb-2">
            <Badge tone="indigo">{route.DoDai} km theo CSDL</Badge>
            <Badge>Cấp {route.DoPhucTap}</Badge>
          </div>
        )}
      </form>
      <ErrorBox error={error} />
      {locations?.notice && <Notice>{locations.notice}</Notice>}
      {locations ? (
        <MapView locations={locations} />
      ) : (
        <div className="map-placeholder">
          <Map size={45} />
          <h3>
            {busy ? "Đang xác định vị trí…" : "Khám phá hành trình trên bản đồ"}
          </h3>
          <p>
            Chọn tuyến rồi nhấn “Tải bản đồ”. Tính năng sử dụng OpenStreetMap và
            cần kết nối Internet.
          </p>
        </div>
      )}
      {route && (
        <div className="map-actions">
          <a
            className="btn btn-secondary"
            target="_blank"
            rel="noreferrer"
            href={
              "https://www.openstreetmap.org/search?query=" +
              encodeURIComponent(route.DiemDau + ", Việt Nam")
            }
          >
            <ExternalLink size={15} />
            Điểm đầu: {route.DiemDau}
          </a>
          <a
            className="btn btn-secondary"
            target="_blank"
            rel="noreferrer"
            href={
              "https://www.openstreetmap.org/search?query=" +
              encodeURIComponent(route.DiemCuoi + ", Việt Nam")
            }
          >
            <ExternalLink size={15} />
            Điểm cuối: {route.DiemCuoi}
          </a>
          {locations && (
            <a
              className="btn btn-primary"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${locations.start.lat},${locations.start.lng};${locations.end.lat},${locations.end.lng}`}
            >
              <Navigation size={15} />
              Mở chỉ đường
            </a>
          )}
        </div>
      )}
      <Notice>
        Đường nét đứt chỉ minh họa kết nối hai đầu tuyến, không phải lộ trình
        đường bộ. Độ dài dùng tính lương và bảo dưỡng vẫn lấy từ dữ liệu tuyến
        đường đã lưu.
      </Notice>
    </>
  );
}
