import { readFile, writeFile, mkdir, readdir, stat, unlink, rename } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./validation.js";

const providers = {
  osm: { name: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19 },
};
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maximumBytes = 2 * 1024 * 1024;
const week = 7 * 24 * 60 * 60 * 1000;
const isPng = (bytes) => bytes.length >= 24 && bytes.subarray(0, 8).equals(pngSignature);

function tileError(code, message) {
  return Object.assign(new AppError(503, message), { tileCode: code });
}
function connectionError(error) {
  if (error instanceof AppError) return error;
  const hints = [error.nativeCode, error.cause?.message, error.message, error.cause?.code, error.code, error.name].filter(Boolean).map(String);
  const combined = hints.join(" ");
  const raw = hints.map((value) => value.match(/\b(?:CURL_\d+(?:\/SEC_E_[A-Z_]+)?|ERR_[A-Z0-9_]+|ENOTFOUND|EAI_AGAIN|ECONN[A-Z_]+|ETIMEDOUT|ENOENT|EACCES|EPERM|SYSTEM_[A-Z_]+|MAP_[A-Z_]+)\b/)?.[0]).find(Boolean) || "UNKNOWN";
  let failure;
  if (/CERT|SSL|TLS|CURL_(?:35|51|58|60|77|83|90|91)\b/i.test(combined))
    failure = tileError("TLS_ERROR", "Không xác thực được chứng chỉ máy chủ bản đồ. Hãy kiểm tra ngày giờ máy tính và cấu hình chứng chỉ của mạng.");
  else if (/ENOTFOUND|EAI_AGAIN|NAME_NOT_RESOLVED|CURL_[56]\b/i.test(combined))
    failure = tileError("DNS_ERROR", "Không tìm được địa chỉ máy chủ OpenStreetMap hoặc proxy. Hãy kiểm tra kết nối mạng rồi tải lại ảnh nền.");
  else if (/Abort|Timeout|TIMED_OUT|ETIMEDOUT|CURL_28\b/i.test(combined))
    failure = tileError("TIMEOUT", "Máy chủ OpenStreetMap phản hồi quá chậm. Hãy chờ một lát rồi tải lại ảnh nền.");
  else failure = tileError("NETWORK_ERROR", "Không kết nối được máy chủ OpenStreetMap. Mã lỗi chi tiết bên dưới giúp xác định bước kết nối đang thất bại.");
  failure.nativeCode = raw;
  failure.transport = error.transport || "electron";
  return failure;
}

export function createMapTileService({
  fetch: request = (...args) => globalThis.fetch(...args),
  cacheDirectory = process.env.MAP_TILE_CACHE_DIR,
  now = Date.now,
} = {}) {
  const memory = new Map(), pending = new Map(), diagnostics = new Map(), cooldown = new Map();
  let active = 0, writes = 0, trimming = Promise.resolve();
  const waiting = [];
  async function limited(callback) {
    if (active >= 4) {
      if (waiting.length >= 64) throw tileError("BUSY", "Bản đồ đang tải nhiều ảnh. Vui lòng đợi một lát.");
      await new Promise((resolve) => waiting.push(resolve));
    } else active++;
    try { return await callback(); }
    finally { if (waiting.length) waiting.shift()(); else active--; }
  }
  function remember(key, value) {
    memory.delete(key); memory.set(key, value);
    if (memory.size > 96) memory.delete(memory.keys().next().value);
  }
  async function load(key) {
    if (memory.has(key)) return memory.get(key);
    if (!cacheDirectory) return null;
    try {
      const filename = path.join(cacheDirectory, key + ".json");
      if ((await stat(filename)).size > maximumBytes * 1.5) return null;
      const value = JSON.parse(await readFile(filename, "utf8"));
      const bytes = Buffer.from(value.png || "", "base64");
      if (!Number.isFinite(value.expires) || !isPng(bytes) || bytes.length > maximumBytes) return null;
      const tile = { ...value, bytes }; remember(key, tile); return tile;
    } catch { return null; }
  }
  async function trim() {
    const entries = await readdir(cacheDirectory);
    const files = (await Promise.all(entries.filter((name) => /^\w+-\d+-\d+-\d+\.json$/.test(name)).map(async (name) => {
      const filename = path.join(cacheDirectory, name);
      const info = await stat(filename).catch(() => null);
      return info && { filename, bytes: info.size, time: info.mtimeMs };
    }))).filter(Boolean).sort((a, b) => a.time - b.time);
    let total = files.reduce((sum, file) => sum + file.bytes, 0);
    for (const file of files) {
      if (total <= 128 * 1024 * 1024) break;
      await unlink(file.filename).catch(() => {}); total -= file.bytes;
    }
  }
  async function save(key, tile) {
    if (tile.noStore) {
      memory.delete(key);
      if (cacheDirectory) await unlink(path.join(cacheDirectory, key + ".json")).catch(() => {});
      return;
    }
    remember(key, tile);
    if (!cacheDirectory) return;
    try {
      await mkdir(cacheDirectory, { recursive: true });
      const filename = path.join(cacheDirectory, key + ".json"), temporary = filename + ".tmp";
      const { bytes, ...metadata } = tile;
      await writeFile(temporary, JSON.stringify({ ...metadata, png: bytes.toString("base64") }), { mode: 0o600 });
      await rename(temporary, filename);
      if (++writes % 16 === 0) trimming = trimming.catch(() => {}).then(trim).catch(() => {});
    } catch (error) { console.warn("MAP_TILE_CACHE", error.code || error.name); }
  }
  function expiry(headers) {
    const control = headers.get("cache-control") || "";
    const maxAge = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(control);
    const expires = Date.parse(headers.get("expires") || "");
    const age = Number(headers.get("age") || 0) * 1000;
    return {
      expires: /no-cache/i.test(control) ? now() : maxAge ? now() + Math.max(0, Number(maxAge[1]) * 1000 - age)
        : Number.isFinite(expires) ? expires : now() + week,
      noStore: /no-store/i.test(control),
    };
  }
  function status(provider, value) { diagnostics.set(provider, { ...value, at: new Date(now()).toISOString() }); }
  return {
    status(provider = "osm") {
      if (!providers[provider]) throw new AppError(400, "Nguồn bản đồ không hợp lệ.");
      return { provider, name: providers[provider].name, ...(diagnostics.get(provider) || { ok: null, code: "NOT_REQUESTED", message: "Chưa có yêu cầu tải ảnh nền." }) };
    },
    async getTile({ provider, z, x, y, referer }) {
      const source = providers[provider];
      if (!source || ![z, x, y].every((number) => /^\d{1,7}$/.test(String(number))))
        throw new AppError(400, "Địa chỉ ảnh bản đồ không hợp lệ.");
      const zoom = Number(z), tileX = Number(x), tileY = Number(y);
      if (zoom > source.maxZoom || tileX >= 2 ** zoom || tileY >= 2 ** zoom)
        throw new AppError(400, "Vị trí ảnh bản đồ nằm ngoài phạm vi.");
      const key = `${provider}-${zoom}-${tileX}-${tileY}`;
      if (pending.has(key)) return pending.get(key);
      const task = (async () => {
        const previous = await load(key);
        if (previous && previous.expires > now()) {
          status(provider, { ok: true, code: "CACHE", message: "Đã tải ảnh nền đã lưu." });
          return previous;
        }
        if ((cooldown.get(provider)?.until || 0) > now()) throw cooldown.get(provider).error;
        return limited(async () => {
          if ((cooldown.get(provider)?.until || 0) > now()) throw cooldown.get(provider).error;
          const headers = { "User-Agent": `VanHanhProject5/1.3.5${process.env.MAP_CONTACT ? " (" + process.env.MAP_CONTACT + ")" : ""}`, Accept: "image/png" };
          if (referer && /^https?:\/\//.test(referer)) headers.Referer = referer.slice(0, 2048);
          if (previous?.etag) headers["If-None-Match"] = previous.etag;
          if (previous?.modified) headers["If-Modified-Since"] = previous.modified;
          const url = source.url.replace("{z}", zoom).replace("{x}", tileX).replace("{y}", tileY);
          const response = await request(url, { headers, signal: AbortSignal.timeout(12000), credentials: "omit", redirect: "error" });
          let tile;
          if (response.status === 304 && previous) {
            tile = { ...previous, ...expiry(response.headers) };
          } else {
            if (!response.ok) {
              const error = tileError("HTTP_" + response.status, response.status === 403
                ? "Máy chủ OpenStreetMap đang từ chối kết nối. Vui lòng chờ rồi thử lại; giữ mã lỗi bên dưới nếu cần kiểm tra kết nối."
                : response.status === 429 ? "Máy chủ bản đồ đang giới hạn truy cập. Vui lòng chờ trước khi thử lại."
                : "Máy chủ OpenStreetMap tạm thời không khả dụng. Vui lòng chờ một lát rồi tải lại ảnh nền.");
              if ([403, 429].includes(response.status)) {
                const retry = response.headers.get("retry-after");
                const milliseconds = /^\d+$/.test(retry || "") ? Number(retry) * 1000 : Date.parse(retry || "") - now();
                cooldown.set(provider, { until: now() + Math.max(30000, Number.isFinite(milliseconds) ? milliseconds : 60000), error });
              }
              throw error;
            }
            if (!response.headers.get("content-type")?.toLowerCase().startsWith("image/png"))
              throw tileError("INVALID_IMAGE", "Máy chủ không trả về ảnh bản đồ hợp lệ.");
            if (Number(response.headers.get("content-length")) > maximumBytes)
              throw tileError("INVALID_IMAGE", "Ảnh bản đồ vượt kích thước cho phép.");
            const reader = response.body.getReader(), chunks = [];
            let length = 0;
            try {
              while (true) {
                const { done, value } = await reader.read(); if (done) break;
                length += value.byteLength;
                if (length > maximumBytes) throw tileError("INVALID_IMAGE", "Ảnh bản đồ vượt kích thước cho phép.");
                chunks.push(Buffer.from(value));
              }
            } finally { await reader.cancel().catch(() => {}); }
            const bytes = Buffer.concat(chunks);
            if (!isPng(bytes)) throw tileError("INVALID_IMAGE", "Máy chủ không trả về ảnh bản đồ hợp lệ.");
            tile = { bytes, ...expiry(response.headers), etag: response.headers.get("etag"), modified: response.headers.get("last-modified") };
          }
          await save(key, tile);
          status(provider, { ok: true, code: "ONLINE", message: "Đã kết nối máy chủ ảnh nền." });
          return tile;
        });
      })().catch((error) => {
        if (error instanceof AppError && error.status < 500) throw error;
        const failure = connectionError(error);
        status(provider, { ok: false, code: failure.tileCode, nativeCode: failure.nativeCode, transport: failure.transport, message: failure.message });
        throw failure;
      });
      pending.set(key, task);
      try { return await task; } finally { pending.delete(key); }
    },
  };
}

let service = createMapTileService();
export function configureMapTiles(options) { service = createMapTileService(options); }
export function getMapTile(options) { return service.getTile(options); }
export function mapTileStatus(provider) { return service.status(provider); }
