const form = document.getElementById("connection-form");
const status = document.getElementById("status");
let hasPassword = false,
  passwordSource = null;

function message(text, type = "") {
  status.hidden = false;
  status.textContent = text;
  status.className = "status " + type;
}
function busy(value) {
  form.querySelectorAll("button,input").forEach((element) => {
    element.disabled = value;
  });
  if (!value && document.getElementById("storage-note").hidden === false)
    document.getElementById("remember").disabled = true;
}
function values() {
  const value = {
    host: form.host.value.trim(),
    port: Number(form.port.value),
    user: form.user.value.trim(),
    database: form.database.value.trim(),
    password: form.password.value,
    rememberPassword: document.getElementById("remember").checked,
    initialize: document.getElementById("initialize").checked,
  };
  value.useSavedPassword =
    hasPassword &&
    !value.password &&
    value.host === passwordSource?.host &&
    value.port === passwordSource?.port &&
    value.user === passwordSource?.user;
  return value;
}
async function load() {
  try {
    const settings = await window.desktop.getSettings();
    for (const key of ["host", "port", "user", "database"])
      form[key].value = settings[key];
    hasPassword = settings.hasPassword;
    passwordSource = settings;
    document.getElementById("version").textContent = "· " + settings.version;
    document.getElementById("initialize").checked = !settings.configured;
    document.getElementById("back").hidden = !settings.connected;
    if (hasPassword) {
      form.password.placeholder = "Để trống để dùng mật khẩu hiện có";
      document.getElementById("password-hint").textContent =
        "Mật khẩu hiện có được giữ khi máy chủ và tài khoản không thay đổi.";
    }
    if (!settings.canRemember) {
      document.getElementById("remember").checked = false;
      document.getElementById("remember").disabled = true;
      document.getElementById("storage-note").hidden = false;
    }
    if (settings.error) message(settings.error, "error");
  } catch {
    message("Không đọc được cấu hình. Hãy đóng và mở lại ứng dụng.", "error");
  }
}
document.getElementById("test").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  busy(true);
  message("Đang kiểm tra kết nối…");
  try {
    const result = await window.desktop.testConnection(values());
    message(
      result.ok
        ? `Kết nối MySQL ${result.version} thành công. ${result.databaseExists ? "CSDL đã tồn tại." : "CSDL chưa có; hãy chọn khởi tạo cấu trúc."}`
        : result.message,
      result.ok ? "success" : "error",
    );
  } catch {
    message("Không kiểm tra được kết nối. Vui lòng thử lại.", "error");
  } finally {
    busy(false);
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const input = values();
  busy(true);
  message("Đang kết nối…");
  try {
    const result = await window.desktop.connect(input);
    if (!result.ok) message(result.message, "error");
  } catch {
    message("Không mở được ứng dụng. Kiểm tra lại MySQL và thử lại.", "error");
  } finally {
    busy(false);
  }
});
document
  .getElementById("back")
  .addEventListener("click", () => window.desktop.resume());
window.desktop.onProgress((text) => message(text));
load();
