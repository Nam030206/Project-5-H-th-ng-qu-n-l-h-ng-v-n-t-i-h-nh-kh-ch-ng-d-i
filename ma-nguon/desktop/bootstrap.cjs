const fs = require("node:fs/promises");
const path = require("node:path");

const UI_SCHEME = "vanhanh-ui";
const UI_HOST = "bootstrap";
const SETUP_URL = `${UI_SCHEME}://${UI_HOST}/desktop/setup.html`;
const LOADING_URL = `${UI_SCHEME}://${UI_HOST}/desktop/loading.html`;
const assets = [
  ["/desktop/loading.html", "desktop/loading.html", "text/html; charset=utf-8"],
  ["/desktop/setup.html", "desktop/setup.html", "text/html; charset=utf-8"],
  ["/desktop/setup.css", "desktop/setup.css", "text/css; charset=utf-8"],
  ["/desktop/setup.js", "desktop/setup.js", "text/javascript; charset=utf-8"],
  ["/assets/vanhanh.svg", "assets/vanhanh.svg", "image/svg+xml"],
];

async function createBootstrapHandler(root, readAsset = fs.readFile) {
  const responses = new Map();
  for (const [urlPath, relativePath, contentType] of assets) {
    let content;
    try {
      content = await readAsset(path.join(root, relativePath));
    } catch (cause) {
      throw Object.assign(
        new Error(
          `Không đọc được tệp khởi động ${relativePath}. Hãy giải nén lại đầy đủ bản ứng dụng.`,
          { cause },
        ),
        { code: "BOOTSTRAP_ASSET_MISSING", asset: relativePath },
      );
    }
    responses.set(urlPath, { content, contentType });
  }
  return async function handle(request) {
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...headers, Allow: "GET, HEAD" },
      });
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response("Bad request", { status: 400, headers });
    }
    const asset =
      url.protocol === `${UI_SCHEME}:` &&
      url.hostname === UI_HOST &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
        ? responses.get(url.pathname)
        : null;
    if (!asset) return new Response("Not found", { status: 404, headers });
    return new Response(request.method === "HEAD" ? null : asset.content, {
      status: 200,
      headers: { ...headers, "Content-Type": asset.contentType },
    });
  };
}

module.exports = { UI_SCHEME, SETUP_URL, LOADING_URL, createBootstrapHandler };
