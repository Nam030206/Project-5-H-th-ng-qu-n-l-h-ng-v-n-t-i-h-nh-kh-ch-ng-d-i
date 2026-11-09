const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { createSystemMapHttp, parseResponse } = require("../system-map-http.cjs");

function launcher(output, code = 0, errorText = "") {
  const calls = [];
  const launch = (exe, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.killed = true; child.emit("close", null); };
    calls.push({ exe, args, options, child });
    queueMicrotask(() => {
      if (output != null) child.stdout.write(output);
      if (errorText) child.stderr.write(errorText);
      child.emit("close", code);
    });
    return child;
  };
  return { launch, calls };
}

test("HTTPS hệ điều hành nhận dữ liệu nhị phân, giữ header, không dùng shell hoặc tắt TLS", async () => {
  const body = Buffer.from([137, 80, 78, 71, 0, 13, 255]);
  const mock = launcher(Buffer.concat([Buffer.from("HTTP/2 200\r\nContent-Type: image/png\r\nETag: tile-1\r\n\r\n"), body]));
  const response = await createSystemMapHttp("C:\\Windows\\System32\\curl.exe", mock)("https://tile.openstreetmap.org/8/203/112.png", { headers: { "User-Agent": "VanHanhProject5/1.3.5", Referer: "http://127.0.0.1/", Cookie: "secret" } });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
  const call = mock.calls[0];
  assert.equal(call.args[0], "--disable");
  assert.ok(call.args.includes("User-Agent: VanHanhProject5/1.3.5"));
  assert.ok(!call.args.some((value) => /insecure|secret|location/.test(value)));
  assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
  assert.ok(!Object.hasOwn(call.options.env, "DB_PASSWORD"));
});

test("HTTP 403/429 giữ nguyên phản hồi để tôn trọng giới hạn máy chủ; 304 không có body", async () => {
  for (const code of [403, 429, 304]) {
    const response = parseResponse(Buffer.from(`HTTP/1.1 ${code} Status\r\nContent-Type: text/plain\r\n\r\n${code === 304 ? "" : "blocked"}`));
    assert.equal(response.status, code);
    if (code === 304) assert.equal(await response.text(), "");
  }
});

test("Lỗi chứng chỉ Windows giữ mã thật; không đưa thông tin proxy vào thông báo", async () => {
  const mock = launcher(null, 60, "curl: (60) schannel: SEC_E_UNTRUSTED_ROOT at private proxy");
  await assert.rejects(createSystemMapHttp("curl.exe", mock)("https://tile.openstreetmap.org/8/203/112.png"), (error) => {
    assert.equal(error.nativeCode, "CURL_60/SEC_E_UNTRUSTED_ROOT");
    assert.equal(error.transport, "system-https");
    assert.ok(!error.message.includes("private proxy")); return true;
  });
});

test("Bộ tải hệ điều hành từ chối URL/header sai và hủy tiến trình khi hết hạn", async () => {
  const mock = launcher(null);
  await assert.rejects(createSystemMapHttp("curl.exe", mock)("http://example.invalid/"));
  await assert.rejects(createSystemMapHttp("curl.exe", mock)("https://tile.openstreetmap.org/", { headers: { Referer: "value\r\nInjected: bad" } }));
  assert.equal(mock.calls.length, 0);
  const controller = new AbortController();
  const pending = createSystemMapHttp("curl.exe", mock)("https://tile.openstreetmap.org/8/203/112.png", { signal: controller.signal });
  controller.abort(new DOMException("timeout", "TimeoutError"));
  await assert.rejects(pending, (error) => error.name === "TimeoutError");
  assert.equal(mock.calls[0].child.killed, true);
});
