import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./validation.js";

const reference = JSON.parse(
  readFileSync(new URL("../data/map-places.json", import.meta.url), "utf8"),
);
const keyOf = (place) => place.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const validPoint = (point) =>
  point && typeof point.lat === "number" && typeof point.lng === "number" &&
  Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
  Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
const lifetime = 24 * 60 * 60 * 1000;

export function createMapService({
  fetch: request = (...args) => globalThis.fetch(...args),
  cacheFile = process.env.MAP_CACHE_FILE,
  endpoint = process.env.MAP_GEOCODER_URL || "https://nominatim.openstreetmap.org/search",
  now = Date.now,
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  referencePlaces = reference.places,
} = {}) {
  const cache = new Map(), pending = new Map();
  const known = new Map(referencePlaces.map((place) => [keyOf(place.name), place]));
  let queue = Promise.resolve(), lastRequest = -Infinity, saving = Promise.resolve();
  const ready = (async () => {
    if (!cacheFile) return;
    try {
      const stored = JSON.parse(await readFile(cacheFile, "utf8"));
      if (stored.version !== 1 || !Array.isArray(stored.entries)) return;
      for (const row of stored.entries.slice(-500)) {
        if (typeof row.key === "string" && Number.isFinite(row.time) && validPoint(row.value))
          cache.set(row.key, row);
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("MAP_CACHE_READ", error.code || error.name);
    }
  })();

  function save() {
    if (!cacheFile) return Promise.resolve();
    saving = saving.catch(() => {}).then(async () => {
      try {
        await mkdir(path.dirname(cacheFile), { recursive: true });
        const temporary = cacheFile + "." + process.pid + ".tmp";
        await writeFile(temporary, JSON.stringify({ version: 1, entries: [...cache.values()].slice(-500) }), { mode: 0o600 });
        await rename(temporary, cacheFile);
      } catch (error) {
        console.warn("MAP_CACHE_WRITE", error.code || error.name);
      }
    });
    return saving;
  }

  async function lookup(place) {
    if (typeof place !== "string" || !place.trim() || place.length > 100)
      throw new AppError(422, "Tên điểm đầu hoặc điểm cuối không hợp lệ.");
    const label = place.trim(), key = keyOf(place);
    const storedPlace = known.get(key);
    if (storedPlace)
      return { lat: storedPlace.lat, lng: storedPlace.lng, label, source: "reference" };
    await ready;
    const cached = cache.get(key);
    if (cached && now() - cached.time < lifetime)
      return { ...cached.value, label, source: "cache" };
    if (pending.has(key)) return pending.get(key);
    const task = queue.catch(() => {}).then(async () => {
      const wait = Math.max(0, 1100 - (now() - lastRequest));
      if (wait) await sleep(wait);
      lastRequest = now();
      try {
        const url = new URL(endpoint);
        if (url.protocol !== "https:" || url.username || url.password)
          throw new AppError(503, "Địa chỉ dịch vụ tra cứu bản đồ phải sử dụng HTTPS.");
        url.searchParams.set("q", `${label}, Việt Nam`);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "vn");
        if (process.env.MAP_CONTACT) url.searchParams.set("email", process.env.MAP_CONTACT);
        const response = await request(url.toString(), {
          headers: {
            "User-Agent": `VanHanhProject5/1.3.5${process.env.MAP_CONTACT ? " (" + process.env.MAP_CONTACT + ")" : ""}`,
            "Accept-Language": "vi", Accept: "application/json",
          },
          credentials: "omit", redirect: "error", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          if (response.status === 429)
            throw new AppError(503, "Dịch vụ tra cứu bản đồ đang giới hạn lượt truy cập. Vui lòng chờ một lát rồi thử lại.");
          if (response.status === 403)
            throw new AppError(503, "Dịch vụ tra cứu bản đồ đang từ chối kết nối. Bạn có thể mở liên kết điểm đầu/điểm cuối bên dưới.");
          throw new AppError(503, "Dịch vụ tra cứu bản đồ tạm thời không khả dụng. Vui lòng thử lại sau.");
        }
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error("INVALID_MAP_RESPONSE");
        if (!rows.length) throw new AppError(404, `Không tìm thấy vị trí “${label}”. Hãy ghi rõ tên thành phố hoặc địa chỉ.`);
        const point = { lat: Number(rows[0].lat), lng: Number(rows[0].lon), label };
        if (rows[0].lat == null || rows[0].lon == null || rows[0].lat === "" || rows[0].lon === "" || !validPoint(point))
          throw new Error("INVALID_MAP_COORDINATES");
        cache.delete(key);
        cache.set(key, { key, value: point, time: now() });
        if (cache.size > 500) cache.delete(cache.keys().next().value);
        await save();
        return { ...point, source: "online" };
      } catch (error) {
        if (cached && error.status !== 404)
          return { ...cached.value, label, source: "stale-cache" };
        if (error instanceof AppError) throw error;
        console.warn("MAP_LOOKUP_FAILED", error.cause?.code || error.code || error.name);
        if (error.name === "AbortError" || error.name === "TimeoutError")
          throw new AppError(503, "Tra cứu vị trí quá thời gian chờ. Hãy kiểm tra Internet rồi nhấn Tải bản đồ lại.");
        if (error.name === "SyntaxError" || error.message?.startsWith("INVALID_MAP_"))
          throw new AppError(503, "Dịch vụ bản đồ trả về dữ liệu vị trí không hợp lệ. Vui lòng thử lại sau.");
        throw new AppError(503, "Không kết nối được dịch vụ tra cứu vị trí. Hãy kiểm tra Internet, VPN hoặc proxy; bạn vẫn có thể mở liên kết bản đồ bên dưới.");
      }
    });
    queue = task;
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }

  return {
    async routeLocations(route) {
      const start = await lookup(route.DiemDau), end = await lookup(route.DiemCuoi);
      return {
        start, end,
        notice: [start, end].some((point) => point.source === "stale-cache")
          ? "Dịch vụ tra cứu đang gián đoạn. Đang dùng vị trí đã lưu từ lần xem trước."
          : [start, end].some((point) => point.source === "reference")
            ? "Đang dùng vị trí đại diện của địa danh đã lưu sẵn từ OpenStreetMap, chưa phải vị trí bến xe cụ thể."
            : null,
      };
    },
  };
}

let service = createMapService();
export function configureMapService(options) { service = createMapService(options); }
export function routeLocations(route) { return service.routeLocations(route); }
