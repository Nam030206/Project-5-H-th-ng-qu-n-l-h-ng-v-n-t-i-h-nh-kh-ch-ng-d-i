const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

function findSystemCurl() {
  const candidates = process.platform === "win32"
    ? [path.join(process.env.SystemRoot || "C:\\Windows", "System32", "curl.exe")]
    : ["/usr/bin/curl", "/usr/local/bin/curl"];
  return candidates.find((filename) => existsSync(filename)) || null;
}

function networkEnvironment() {
  const allowed = /^(?:PATH|SystemRoot|WINDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|SSL_CERT_FILE|SSL_CERT_DIR|CURL_CA_BUNDLE|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$/i;
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.test(name)));
}

function parseResponse(buffer) {
  let offset = 0;
  while (true) {
    const end = buffer.indexOf("\r\n\r\n", offset);
    if (end < 0 || end - offset > 65536) throw Object.assign(new Error("Phản hồi HTTPS không hợp lệ."), { code: "SYSTEM_HTTP_RESPONSE" });
    const lines = buffer.subarray(offset, end).toString("latin1").split("\r\n");
    const match = /^HTTP\/\d+(?:\.\d+)?\s+(\d{3})\b/.exec(lines.shift());
    if (!match) throw Object.assign(new Error("Phản hồi HTTPS không hợp lệ."), { code: "SYSTEM_HTTP_RESPONSE" });
    const status = Number(match[1]); offset = end + 4;
    if (status < 200) continue;
    const headers = new Headers();
    for (const line of lines) {
      const separator = line.indexOf(":");
      if (separator > 0) headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
    const body = [204, 205, 304].includes(status) ? null : buffer.subarray(offset);
    return new Response(body, { status, headers });
  }
}

function createSystemMapHttp(executable, { launch = spawn } = {}) {
  const request = (input, { headers = {}, signal = AbortSignal.timeout(15000) } = {}) => new Promise((resolve, reject) => {
    let child, settled = false, size = 0, stderr = "";
    const chunks = [];
    function fail(error) {
      if (settled) return;
      settled = true; signal.removeEventListener("abort", abort);
      error.transport = "system-https"; reject(error);
    }
    function abort() { fail(signal.reason || new DOMException("Đã hủy tải", "AbortError")); child?.kill(); }
    if (signal.aborted) return abort();
    try {
      const url = new URL(input);
      if (url.protocol !== "https:" || url.username || url.password)
        throw Object.assign(new Error("Bộ tải bản đồ chỉ chấp nhận HTTPS không kèm tài khoản."), { code: "SYSTEM_HTTP_URL" });
      const args = ["--disable", "--silent", "--show-error", "--globoff", "--include", "--suppress-connect-headers", "--proto", "=https", "--connect-timeout", "8", "--max-time", "12", "--max-filesize", "2097152"];
      const permitted = /^(?:User-Agent|Referer|Accept|Accept-Language|If-None-Match|If-Modified-Since)$/i;
      for (const [name, value] of Object.entries(headers)) {
        if (!permitted.test(name)) continue;
        if (/[\r\n\0]/.test(String(value))) throw new Error("Giá trị HTTP header không hợp lệ.");
        args.push("--header", name + ": " + String(value));
      }
      args.push("--url", url.href);
      child = launch(executable, args, { cwd: path.dirname(executable), windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"], env: networkEnvironment() });
      signal.addEventListener("abort", abort, { once: true });
      child.on("error", fail);
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024 + 65536) {
          fail(Object.assign(new Error("Phản hồi bản đồ vượt giới hạn."), { code: "MAP_RESPONSE_TOO_LARGE" })); child.kill();
        } else chunks.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk) => { if (stderr.length < 4096) stderr += chunk.toString().slice(0, 4096 - stderr.length); });
      child.on("close", (code) => {
        if (settled) return;
        if (code !== 0) {
          const detail = /\bSEC_E_[A-Z_]+\b/.exec(stderr)?.[0];
          return fail(Object.assign(new Error("Bộ tải HTTPS hệ điều hành không hoàn tất kết nối."), { code: "CURL_" + code, nativeCode: "CURL_" + code + (detail ? "/" + detail : "") }));
        }
        try {
          const response = parseResponse(Buffer.concat(chunks));
          settled = true; signal.removeEventListener("abort", abort); resolve(response);
        } catch (error) { fail(error); }
      });
    } catch (error) { fail(error); }
  });
  request.transport = "system-https";
  return request;
}

module.exports = { findSystemCurl, createSystemMapHttp, parseResponse };
