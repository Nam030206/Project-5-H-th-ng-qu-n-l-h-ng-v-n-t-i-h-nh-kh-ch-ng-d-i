const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createMapHttp } = require("../map-http.cjs");

function mockNet(complete) {
  const calls = [];
  return {
    calls,
    request(options) {
      const item = new EventEmitter();
      item.options = options; item.headers = {}; item.aborted = false;
      item.setHeader = (name, value) => { item.headers[name] = value; };
      item.abort = () => { item.aborted = true; item.emit("abort"); };
      item.end = () => queueMicrotask(() => complete?.(item));
      calls.push(item); return item;
    },
  };
}

test("Bộ tải Electron gửi nguyên User-Agent/referrer, nhận đầy đủ dữ liệu sau close của request", async () => {
  const net = mockNet((item) => {
    const response = new EventEmitter();
    response.statusCode = 200; response.headers = { "content-type": ["application/json"] };
    item.emit("response", response);
    item.emit("close");
    response.emit("data", Buffer.from('{"ok":'));
    response.emit("data", Buffer.from('true}'));
    response.emit("end");
  });
  const result = await createMapHttp(net, { curlPath: null })("https://tile.openstreetmap.org/8/203/112.png", { headers: { "User-Agent": "VanHanhProject5/1.3.4", Referer: "http://127.0.0.1/" } });
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(net.calls[0].headers["User-Agent"], "VanHanhProject5/1.3.4");
  assert.equal(net.calls[0].headers.Referer, "http://127.0.0.1/");
  assert.equal(net.calls[0].options.credentials, "omit");
  assert.equal(net.calls[0].options.redirect, "error");
});

test("Hủy tải ảnh hủy luôn yêu cầu mạng; lỗi native giữ nguyên để chẩn đoán", async () => {
  const controller = new AbortController(), net = mockNet();
  const pending = createMapHttp(net, { curlPath: null })("https://tile.openstreetmap.org/8/203/112.png", { signal: controller.signal });
  controller.abort(new DOMException("timeout", "TimeoutError"));
  await assert.rejects(pending, (error) => error.name === "TimeoutError");
  assert.equal(net.calls[0].aborted, true);
  const failing = mockNet((item) => item.emit("error", new Error("net::ERR_CERT_AUTHORITY_INVALID")));
  await assert.rejects(createMapHttp(failing, { curlPath: null })("https://tile.openstreetmap.org/8/203/112.png"), /ERR_CERT_AUTHORITY_INVALID/);
});

test("Bộ tải native xử lý 304 và ngắt dữ liệu vượt giới hạn", async () => {
  for (const oversized of [false, true]) {
    const net = mockNet((item) => {
      const response = new EventEmitter();
      response.statusCode = oversized ? 200 : 304; response.headers = { etag: ['"tile-v1"'] };
      item.emit("response", response);
      if (oversized) response.emit("data", Buffer.alloc(2 * 1024 * 1024 + 1));
      response.emit("end");
    });
    const result = createMapHttp(net, { curlPath: null })("https://tile.openstreetmap.org/8/203/112.png");
    if (oversized) await assert.rejects(result, (error) => error.code === "MAP_RESPONSE_TOO_LARGE");
    else assert.equal((await result).status, 304);
  }
});
