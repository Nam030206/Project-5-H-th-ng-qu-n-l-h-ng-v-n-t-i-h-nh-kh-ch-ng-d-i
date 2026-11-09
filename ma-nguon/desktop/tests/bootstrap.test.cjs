const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  UI_SCHEME,
  SETUP_URL,
  LOADING_URL,
  createBootstrapHandler,
} = require("../bootstrap.cjs");
const { trustedFrame, trustedNavigation } = require("../policy.cjs");
const root = path.resolve(__dirname, "../..");

test("Màn hình chờ và cấu hình đọc từ gói qua giao thức nội bộ", async () => {
  const handle = await createBootstrapHandler(root);
  for (const [url, type, match] of [
    [LOADING_URL, "text/html", "Đang mở Vận Hành"],
    [SETUP_URL, "text/html", "Kết nối cơ sở dữ liệu"],
    [new URL("setup.css", SETUP_URL).href, "text/css", ".loading"],
    [new URL("setup.js", SETUP_URL).href, "text/javascript", "window.desktop"],
    [new URL("../assets/vanhanh.svg", SETUP_URL).href, "image/svg+xml", "<svg"],
  ]) {
    const response = await handle(new Request(url));
    assert.equal(response.status, 200, url);
    assert.ok(response.headers.get("Content-Type").startsWith(type));
    assert.ok((await response.text()).includes(match), url);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("Tên thư mục có khoảng trắng, dấu tiếng Việt, # và % không lọt vào URL giao diện", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "Vận Hành # 100% "),
  );
  try {
    await fs.cp(path.join(root, "desktop"), path.join(directory, "desktop"), {
      recursive: true,
    });
    await fs.cp(path.join(root, "assets"), path.join(directory, "assets"), {
      recursive: true,
    });
    const handle = await createBootstrapHandler(directory);
    assert.equal((await handle(new Request(LOADING_URL))).status, 200);
    assert.equal((await handle(new Request(SETUP_URL))).status, 200);
    assert.ok(!LOADING_URL.includes(directory));
    const paths = [];
    const windowsHandler = await createBootstrapHandler(
      "C:\\Users\\ADMIN\\AppData\\Local\\Temp\\Vận Hành # 100%\\resources\\app.asar",
      async (name) => {
        paths.push(name);
        return Buffer.from("asset");
      },
    );
    assert.equal((await windowsHandler(new Request(LOADING_URL))).status, 200);
    assert.ok(paths.every((name) => !name.startsWith("file:")));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("Chỉ phục vụ tài nguyên cố định, chặn đường dẫn tùy ý và phương thức ghi", async () => {
  const handle = await createBootstrapHandler(root);
  for (const url of [
    `${UI_SCHEME}://other/desktop/setup.html`,
    `${UI_SCHEME}://bootstrap/server/config/index.js`,
    `${UI_SCHEME}://bootstrap/desktop/../../.env`,
    `${UI_SCHEME}://bootstrap/desktop/%2e%2e/%2e%2e/server/app.js`,
    `${UI_SCHEME}://user@bootstrap/desktop/setup.html`,
    `${SETUP_URL}?file=../../database.json`,
    "file:///C:/Users/ADMIN/AppData/Local/Temp/loading.html",
    "https://untrusted.invalid/desktop/setup.html",
  ])
    assert.equal((await handle({ url, method: "GET" })).status, 404, url);
  assert.equal(
    (await handle(new Request(SETUP_URL, { method: "POST", body: "secret" })))
      .status,
    405,
  );
  const head = await handle(new Request(SETUP_URL, { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("Trang chờ được điều hướng nhưng không được gọi IPC cấu hình", () => {
  assert.equal(
    trustedNavigation(LOADING_URL, "", SETUP_URL, LOADING_URL),
    true,
  );
  assert.equal(trustedFrame(LOADING_URL, "", SETUP_URL), false);
  assert.equal(trustedFrame(SETUP_URL, "", SETUP_URL), true);
  assert.equal(trustedFrame(SETUP_URL + "?other=1", "", SETUP_URL), false);
  assert.equal(
    trustedNavigation("file:///loading.html", "", SETUP_URL, LOADING_URL),
    false,
  );
  assert.equal(
    trustedFrame(
      "http://127.0.0.1:3100/#/",
      "http://127.0.0.1:3100",
      SETUP_URL,
    ),
    true,
  );
  assert.equal(
    trustedFrame(
      "http://127.0.0.1:3101/#/",
      "http://127.0.0.1:3100",
      SETUP_URL,
    ),
    false,
  );
});

test("Thiếu tài nguyên được báo rõ trước khi mở cửa sổ", async () => {
  await assert.rejects(
    createBootstrapHandler(root, async () => {
      throw new Error("ENOENT");
    }),
    (error) =>
      error.code === "BOOTSTRAP_ASSET_MISSING" &&
      error.asset === "desktop/loading.html",
  );
});

for (const mode of ["normal", "splash-fails"])
  test(`Luồng main thực đến cấu hình MySQL khi ${mode}`, () => {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, "startup-smoke-child.cjs"), mode],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.ok(result.stdout.includes("STARTUP_OK " + mode));
  });
