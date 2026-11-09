import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { createMapService } from "../services/map-service.js";
import { AppError } from "../services/validation.js";
import { createApp } from "../app.js";
import { pool } from "../config/database.js";

const pointResponse = () => Response.json([{ lat: "21.0283334", lon: "105.8540410" }]);
const route = { DiemDau: "Địa điểm thử A", DiemCuoi: "Địa điểm thử A" };
const base = { referencePlaces: [], cacheFile: null, sleep: async () => {} };

test("Sáu tuyến mẫu tải vị trí khi dịch vụ tra cứu mất kết nối", async () => {
  const service = createMapService({ fetch: () => { throw new Error("Không được gọi mạng"); } });
  for (const city of ["Hải Phòng", "Nam Định", "Vinh", "Lào Cai", "Sơn La", "Điện Biên"]) {
    const result = await service.routeLocations({ DiemDau: " Hà Nội ", DiemCuoi: city });
    assert.equal(result.start.source, "reference");
    assert.equal(result.end.source, "reference");
    assert.ok(Number.isFinite(result.end.lat));
    assert.match(result.notice, /chưa phải vị trí bến xe/);
  }
});

test("Lỗi DNS/fetch failed thành lỗi bản đồ 503 có hướng dẫn", async () => {
  const service = createMapService({ ...base, fetch: async () => { throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }); } });
  await assert.rejects(service.routeLocations(route), (error) => error instanceof AppError && error.status === 503 && /Internet, VPN hoặc proxy/.test(error.message));
});

test("Lỗi timeout, 403, 429 và dữ liệu không hợp lệ có thông báo riêng", async () => {
  const cases = [
    [async () => { throw new DOMException("timeout", "TimeoutError"); }, /quá thời gian chờ/],
    [async () => new Response("denied", { status: 403 }), /từ chối kết nối/],
    [async () => new Response("limited", { status: 429 }), /giới hạn lượt/],
    [async () => new Response("down", { status: 502 }), /tạm thời không khả dụng/],
    [async () => Response.json({ error: "invalid" }), /dữ liệu vị trí không hợp lệ/],
    [async () => Response.json([{ lat: "NaN", lon: "105" }]), /dữ liệu vị trí không hợp lệ/],
    [async () => Response.json([{ lat: "", lon: "105" }]), /dữ liệu vị trí không hợp lệ/],
  ];
  for (const [fetch, message] of cases)
    await assert.rejects(createMapService({ ...base, fetch }).routeLocations(route), (error) => error.status === 503 && message.test(error.message));
  await assert.rejects(createMapService({ ...base, fetch: async () => Response.json([]) }).routeLocations(route), (error) => error.status === 404);
});

test("Tra cứu chỉ gửi một lần cho các yêu cầu trùng, tuần tự và cách nhau 1,1 giây", async () => {
  let time = 10000;
  const calls = [], waits = [];
  const service = createMapService({
    ...base, now: () => time,
    sleep: async (ms) => { waits.push(ms); time += ms; },
    fetch: async (url, options) => {
      calls.push({ url: new URL(url), options, time });
      await new Promise((resolve) => setImmediate(resolve));
      return pointResponse();
    },
  });
  const data = { DiemDau: "Địa điểm A", DiemCuoi: "Địa điểm B" };
  await Promise.all([service.routeLocations(data), service.routeLocations(data)]);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].time - calls[0].time >= 1100);
  assert.deepEqual(waits, [1100]);
  assert.equal(calls[0].url.searchParams.get("countrycodes"), "vn");
  assert.match(calls[0].options.headers["User-Agent"], /VanHanhProject5/);
  await service.routeLocations(data);
  assert.equal(calls.length, 2);
});

test("Bộ nhớ vị trí tồn tại sau khi khởi động lại, có thể dùng lại khi dịch vụ gián đoạn", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vanhanh-map-"));
  const cacheFile = path.join(directory, "cache.json");
  try {
    const first = createMapService({ ...base, cacheFile, now: () => 100000, fetch: async () => pointResponse() });
    await first.routeLocations(route);
    const fresh = createMapService({ ...base, cacheFile, now: () => 100001, fetch: () => { throw new Error("Không gọi mạng khi cache còn hạn"); } });
    assert.equal((await fresh.routeLocations(route)).start.source, "cache");
    const stale = createMapService({ ...base, cacheFile, now: () => 100000 + 86400001, fetch: async () => { throw new TypeError("fetch failed"); } });
    const result = await stale.routeLocations(route);
    assert.equal(result.start.source, "stale-cache");
    assert.match(result.notice, /lần xem trước/);
    const data = JSON.parse(await readFile(cacheFile, "utf8"));
    assert.equal(data.entries.length, 1);
    await writeFile(cacheFile, "not json");
    const recovered = createMapService({ ...base, cacheFile, fetch: async () => pointResponse() });
    assert.equal((await recovered.routeLocations(route)).start.source, "online");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Không lấy vị trí tham chiếu cho địa chỉ chỉ chứa một phần tên thành phố", async () => {
  let calls = 0;
  const service = createMapService({ cacheFile: null, fetch: async () => { calls++; return pointResponse(); } });
  const result = await service.routeLocations({ DiemDau: "Bến xe Mỹ Đình, Hà Nội", DiemCuoi: "Hà Nội" });
  assert.equal(calls, 1);
  assert.equal(result.start.source, "online");
});

test("HTTP giữ thông báo lỗi bản đồ 503; CSP và referrer cho phép máy chủ ảnh nền chuẩn", async (t) => {
  t.mock.method(pool, "query", async () => { throw new AppError(503, "Không kết nối được dịch vụ tra cứu vị trí."); });
  const response = await request(createApp()).get("/api/health");
  assert.equal(response.status, 503);
  assert.equal(response.body.message, "Không kết nối được dịch vụ tra cứu vị trí.");
  assert.match(response.headers["content-security-policy"], /https:\/\/tile\.openstreetmap\.org/);
  assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
});
