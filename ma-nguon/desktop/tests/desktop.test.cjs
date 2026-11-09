const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  validateConnection,
  createConfigStore,
} = require("../config-store.cjs");
const { parseTripLink, allowExternal, trustedFrame } = require("../policy.cjs");

test("Kết nối chỉ nhận host, cổng và tên CSDL hợp lệ", () => {
  assert.equal(
    validateConnection({
      host: "127.0.0.1",
      port: "3306",
      user: "root",
      database: "Project5_VanTai",
    }).port,
    3306,
  );
  assert.throws(() => validateConnection({ database: "db`;DROP DATABASE x;" }));
  assert.throws(() => validateConnection({ host: "https://mysql.invalid" }));
  assert.throws(() => validateConnection({ port: 65536 }));
});
test("Deep link chỉ mở mã chuyến hợp lệ", () => {
  assert.equal(parseTripLink("vanhanh://trip/CX001"), "CX001");
  assert.equal(parseTripLink("https://evil.invalid/trip/CX001"), null);
  assert.equal(parseTripLink("vanhanh://trip/%3Cscript%3E"), null);
  assert.equal(
    parseTripLink("vanhanh://trip/CX001?url=https://evil.invalid"),
    null,
  );
});
test("IPC và điều hướng giới hạn đúng cửa sổ / origin", () => {
  assert.equal(
    trustedFrame(
      "http://127.0.0.1:1234/#/xe-khach",
      "http://127.0.0.1:1234",
      "file:///setup.html",
    ),
    true,
  );
  assert.equal(
    trustedFrame(
      "http://127.0.0.1:1235/",
      "http://127.0.0.1:1234",
      "file:///setup.html",
    ),
    false,
  );
  assert.equal(
    trustedFrame("file:///setup.html", "", "file:///setup.html"),
    true,
  );
  assert.equal(allowExternal("https://www.openstreetmap.org/directions"), true);
  assert.equal(allowExternal("https://openmaps.fr/donate"), false);
  assert.equal(allowExternal("https://github.com/sletuffe/OpenTopoMap"), false);
  assert.equal(allowExternal("https://github.com/login"), false);
  assert.equal(allowExternal("https://openmaps.fr.evil.invalid/donate"), false);
  assert.equal(allowExternal("javascript:alert(1)"), false);
  assert.equal(
    allowExternal("https://www.openstreetmap.org.evil.invalid/"),
    false,
  );
});
test("Cấu hình chỉ lưu mật khẩu đã mã hóa và không trả plaintext trong tệp", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vanhanh-store-"));
  try {
    const filename = path.join(directory, "connection.json");
    const secure = {
      available: async () => true,
      encrypt: async (text) => Buffer.from([...text].reverse().join("")),
      decrypt: async (bytes) => [...bytes.toString()].reverse().join(""),
    };
    const store = createConfigStore(filename, secure),
      password = "MatKhauThuNghiem!";
    await store.save({ database: "Project5_VanTai", password }, true);
    const raw = await fs.readFile(filename, "utf8");
    assert.ok(!raw.includes(password));
    assert.ok(!Object.hasOwn(JSON.parse(raw), "password"));
    const loaded = await store.load();
    assert.equal(loaded.connection.password, password);
    assert.equal(loaded.needsPassword, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("Không có kho khóa thì hỏi lại mật khẩu, không ghi plaintext dự phòng", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vanhanh-store-"));
  try {
    const filename = path.join(directory, "connection.json"),
      store = createConfigStore(filename, { available: async () => false });
    await store.save(
      { database: "Project5_VanTai", password: "KhongLuuPlaintext" },
      true,
    );
    const raw = await fs.readFile(filename, "utf8");
    assert.ok(!raw.includes("KhongLuuPlaintext"));
    assert.equal((await store.load()).needsPassword, true);
    await store.save({ database: "Project5_VanTai", password: "" }, true);
    assert.equal((await store.load()).needsPassword, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
