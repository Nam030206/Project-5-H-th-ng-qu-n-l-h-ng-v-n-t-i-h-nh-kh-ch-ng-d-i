const { findSystemCurl, createSystemMapHttp } = require("./system-map-http.cjs");
function createMapHttp(net, { curlPath = findSystemCurl() } = {}) {
  if (curlPath) return createSystemMapHttp(curlPath);
  return (url, { headers = {}, signal } = {}) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new DOMException("Đã hủy", "AbortError"));
    let request, settled = false;
    function fail(error) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      reject(error);
    }
    function abort() {
      fail(signal?.reason || new DOMException("Đã hủy", "AbortError"));
      request?.abort();
    }
    try {
      request = net.request({ url, method: "GET", redirect: "error", credentials: "omit", useSessionCookies: false });
      for (const [name, value] of Object.entries(headers)) request.setHeader(name, String(value));
      signal?.addEventListener("abort", abort, { once: true });
      request.on("error", fail);
      request.on("abort", () => fail(new DOMException("Đã hủy", "AbortError")));
      request.on("response", (response) => {
        const chunks = [];
        let size = 0;
        response.on("error", fail);
        response.on("aborted", () => fail(new Error("Luồng ảnh bản đồ bị gián đoạn.")));
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            fail(Object.assign(new Error("Ảnh bản đồ vượt kích thước cho phép."), { code: "MAP_RESPONSE_TOO_LARGE" }));
            request.abort();
          } else chunks.push(Buffer.from(chunk));
        });
        response.on("end", () => {
          if (settled) return;
          try {
            const resultHeaders = new Headers();
            for (const [name, values] of Object.entries(response.headers))
              for (const value of Array.isArray(values) ? values : [values])
                if (value != null) resultHeaders.append(name, String(value));
            const body = [204, 205, 304].includes(response.statusCode) ? null : Buffer.concat(chunks);
            const result = new Response(body, { status: response.statusCode, headers: resultHeaders });
            settled = true;
            signal?.removeEventListener("abort", abort);
            resolve(result);
          } catch (error) { fail(error); }
        });
      });
      request.end();
    } catch (error) { fail(error); }
  });
}
module.exports = { createMapHttp };
