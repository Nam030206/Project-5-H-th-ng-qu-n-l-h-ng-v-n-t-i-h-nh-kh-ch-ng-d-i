const fs = require("node:fs/promises");
const path = require("node:path");

const defaults = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  database: "Project5_VanTai",
  password: "",
};

function validateConnection(input) {
  if (!input || typeof input !== "object")
    throw new Error("Thiếu thông tin kết nối MySQL.");
  const value = {
    host: String(input.host ?? defaults.host).trim(),
    port: Number(input.port ?? defaults.port),
    user: String(input.user ?? defaults.user).trim(),
    database: String(input.database ?? defaults.database).trim(),
    password: typeof input.password === "string" ? input.password : "",
  };
  if (
    !value.host ||
    value.host.length > 253 ||
    /[\s/\\\u0000]/.test(value.host)
  )
    throw new Error("Địa chỉ máy chủ không hợp lệ.");
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535)
    throw new Error("Cổng MySQL phải từ 1 đến 65535.");
  if (!value.user || value.user.length > 100 || /[\u0000\r\n]/.test(value.user))
    throw new Error("Tên tài khoản MySQL không hợp lệ.");
  if (!/^[A-Za-z0-9_]{1,64}$/.test(value.database))
    throw new Error(
      "Tên CSDL chỉ gồm chữ, số và dấu gạch dưới; tối đa 64 ký tự.",
    );
  if (value.password.length > 1024) throw new Error("Mật khẩu MySQL quá dài.");
  return value;
}

function createConfigStore(filename, storage) {
  async function load() {
    let stored;
    try {
      stored = JSON.parse(await fs.readFile(filename, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new Error("Tệp kết nối bị lỗi. Vui lòng cấu hình lại MySQL.");
    }
    const connection = validateConnection(stored);
    let needsPassword = !!stored.askPassword;
    if (stored.encryptedPassword) {
      try {
        if (!(await storage.available()))
          throw new Error("Secure storage unavailable");
        connection.password = await storage.decrypt(
          Buffer.from(stored.encryptedPassword, "base64"),
        );
        needsPassword = false;
      } catch {
        connection.password = "";
        needsPassword = true;
      }
    }
    return { connection, needsPassword };
  }
  async function save(input, rememberPassword = true) {
    const connection = validateConnection(input),
      { password, ...stored } = connection;
    stored.version = 1;
    const canRemember = rememberPassword && (await storage.available());
    if (password && canRemember)
      stored.encryptedPassword = (await storage.encrypt(password)).toString(
        "base64",
      );
    stored.askPassword = !!password && !stored.encryptedPassword;
    await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = filename + ".tmp";
    await fs.writeFile(temporary, JSON.stringify(stored, null, 2), {
      mode: 0o600,
    });
    await fs.rename(temporary, filename);
    return { remembered: !stored.askPassword };
  }
  return { load, save };
}

module.exports = { defaults, validateConnection, createConfigStore };
