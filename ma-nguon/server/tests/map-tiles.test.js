import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createMapTileService, configureMapTiles } from "../services/map-tile-service.js";
import { createApp } from "../app.js";
import { pool } from "../config/database.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
const position = { provider: "osm", z: "8", x: "202", y: "111", referer: "http://127.0.0.1:3001/" };
const image = (headers = {}) => new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "max-age=604800", ...headers } });

test("Ảnh nền đi qua API nội bộ: định danh ứng dụng, HTTPS và referrer thật", async () => {
  let calls = 0;
  const service = createMapTileService({ cacheDirectory: null, fetch: async (url, options) => {
    calls++;
    assert.equal(url, "https://tile.openstreetmap.org/8/202/111.png");
    assert.match(options.headers["User-Agent"], /^VanHanhProject5\/1\.3\.5/);
    assert.equal(options.headers.Referer, position.referer);
    assert.equal(options.headers["Cache-Control"], undefined);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return image();
  } });
  assert.deepEqual((await service.getTile(position)).bytes, png);
  await service.getTile(position);
  assert.equal(calls, 1);
  assert.equal(service.status("osm").code, "CACHE");
});

test("Lưu cache ảnh nền qua lần mở app mới, làm mới có điều kiện bằng ETag", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vanhanh-tiles-"));
  let clock = 1000000;
  try {
    const first = createMapTileService({ cacheDirectory: directory, now: () => clock, fetch: async () => image({ etag: '"map-v1"', "Cache-Control": "max-age=60" }) });
    await first.getTile(position);
    const second = createMapTileService({ cacheDirectory: directory, now: () => clock, fetch: () => { throw new Error("Không được gọi mạng khi cache còn hạn"); } });
    assert.deepEqual((await second.getTile(position)).bytes, png);
    clock += 61000;
    let calls = 0;
    const third = createMapTileService({ cacheDirectory: directory, now: () => clock, fetch: async (_url, options) => {
      calls++; assert.equal(options.headers["If-None-Match"], '"map-v1"');
      return new Response(null, { status: 304, headers: { "Cache-Control": "max-age=60" } });
    } });
    assert.deepEqual((await third.getTile(position)).bytes, png);
    await third.getTile(position); assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Gộp yêu cầu trùng và giới hạn kết nối ảnh nền đồng thời", async () => {
  let active = 0, maximum = 0, count = 0;
  const service = createMapTileService({ cacheDirectory: null, fetch: async () => {
    count++; active++; maximum = Math.max(active, maximum);
    await new Promise((resolve) => setImmediate(resolve)); active--;
    return image();
  } });
  const positions = Array.from({ length: 8 }, (_, x) => ({ ...position, z: "3", x: String(x), y: "2" }));
  await Promise.all([...positions, ...positions].map((row) => service.getTile(row)));
  assert.equal(count, 8); assert.ok(maximum <= 4);
});

test("Mã lỗi mạng, chứng chỉ, DNS, thời gian chờ và ảnh HTML được phân biệt", async () => {
  const cases = [
    [async () => { throw Object.assign(new Error("net::ERR_CERT_AUTHORITY_INVALID"), { code: "ERR_FAILED" }); }, "TLS_ERROR"],
    [async () => { throw Object.assign(new Error("HTTPS failed"), { code: "CURL_60", nativeCode: "CURL_60/SEC_E_UNTRUSTED_ROOT" }); }, "TLS_ERROR"],
    [async () => { throw new Error("net::ERR_CERT_AUTHORITY_INVALID"); }, "TLS_ERROR"],
    [async () => { throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }); }, "DNS_ERROR"],
    [async () => { throw new DOMException("slow", "TimeoutError"); }, "TIMEOUT"],
    [async () => { throw new Error("ECONNRESET"); }, "NETWORK_ERROR"],
    [async () => new Response("<html>blocked</html>", { headers: { "Content-Type": "text/html" } }), "INVALID_IMAGE"],
    [async () => new Response("not png", { headers: { "Content-Type": "image/png" } }), "INVALID_IMAGE"],
  ];
  for (const [fetch, code] of cases) {
    const service = createMapTileService({ cacheDirectory: null, fetch });
    await assert.rejects(service.getTile(position), (error) => error.status === 503 && error.tileCode === code);
    assert.equal(service.status("osm").code, code);
    if (code !== "INVALID_IMAGE") assert.ok(service.status("osm").nativeCode);
  }
});

test("HTTP 429/403 được tạm dừng, không lặp gọi máy chủ đang giới hạn", async () => {
  for (const status of [403, 429]) {
    let calls = 0, clock = 100000;
    const service = createMapTileService({ cacheDirectory: null, now: () => clock, fetch: async () => { calls++; return new Response("blocked", { status, headers: { "Retry-After": "120" } }); } });
    await assert.rejects(service.getTile(position));
    await assert.rejects(service.getTile({ ...position, x: "201" }));
    assert.equal(calls, 1);
    clock += 121000;
    await assert.rejects(service.getTile(position)); assert.equal(calls, 2);
    assert.equal(service.status("osm").code, "HTTP_" + status);
  }
});

test("Chỉ dùng OpenStreetMap và chỉ chấp nhận tọa độ hợp lệ", async () => {
  let calls = 0;
  const service = createMapTileService({ cacheDirectory: null, fetch: async (url) => {
    calls++; assert.equal(new URL(url).hostname, "tile.openstreetmap.org"); return image();
  } });
  await service.getTile(position);
  for (const bad of [{ provider: "https://evil.invalid" }, { z: "-1" }, { x: "256" }, { y: "../../" }, { provider: "topo" }, { z: "20" }])
    await assert.rejects(service.getTile({ ...position, ...bad }), (error) => error.status === 400);
  assert.equal(calls, 1);
});

test("Máy chủ yêu cầu no-store thì không lưu ảnh giữa các lần xem", async () => {
  let calls = 0;
  const service = createMapTileService({ cacheDirectory: null, fetch: async () => { calls++; return image({ "Cache-Control": "no-store" }); } });
  await service.getTile(position); await service.getTile(position);
  assert.equal(calls, 2);
});

test("API ảnh nền giữ đăng nhập/phân quyền và không chạy lại tính lương/bảo dưỡng", async (t) => {
  let calls = 0, role = "admin";
  configureMapTiles({ cacheDirectory: null, fetch: async () => { calls++; return image(); } });
  t.mock.method(pool, "execute", async () => [[{ Id: 1, VaiTro: role }]]);
  t.mock.method(pool, "getConnection", async () => { throw new Error("Không gọi thủ tục nghiệp vụ khi tải ảnh bản đồ"); });
  const app = createApp(), url = "/api/maps/tiles/osm/8/202/111.png";
  assert.equal((await request(app).get(url)).status, 401);
  role = "passenger";
  assert.equal((await request(app).get(url).set("Cookie", "vanhanh_session=test")).status, 403);
  role = "admin";
  const response = await request(app).get(url).set("Cookie", "vanhanh_session=test");
  assert.equal(response.status, 200); assert.match(response.headers["content-type"], /image\/png/);
  assert.deepEqual(response.body, png); assert.equal(calls, 1);
  const status = await request(app).get("/api/maps/status/osm").set("Cookie", "vanhanh_session=test");
  assert.equal(status.body.ok, true);
});
