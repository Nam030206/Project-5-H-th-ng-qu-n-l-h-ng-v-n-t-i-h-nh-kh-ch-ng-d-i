import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  safeStorage,
  shell,
  utilityProcess,
  protocol,
} from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import configuration from "./config-store.cjs";
import policy from "./policy.cjs";
import bootstrap from "./bootstrap.cjs";

const root = app.getAppPath();
const {
  UI_SCHEME,
  SETUP_URL: setupUrl,
  LOADING_URL: loadingUrl,
  createBootstrapHandler,
} = bootstrap;
protocol.registerSchemesAsPrivileged([
  {
    scheme: UI_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
const { createConfigStore, validateConnection } = configuration;
const { allowExternal, trustedFrame, trustedNavigation, parseTripLink } =
  policy;
let window,
  service,
  store,
  activeConnection,
  origin = "",
  bootToken = "",
  initialized = true,
  quitting = false,
  busy = false,
  lastError = "";
let pendingTrip = process.argv.map(parseTripLink).find(Boolean) || null;

app.setName("VanHanh");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argumentsList) => {
    const trip = argumentsList.map(parseTripLink).find(Boolean);
    if (trip) {
      pendingTrip = trip;
      openApplication();
    }
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("open-url", (event, value) => {
    event.preventDefault();
    const trip = parseTripLink(value);
    if (trip) {
      pendingTrip = trip;
      openApplication();
    }
  });
  app
    .whenReady()
    .then(launch)
    .catch((error) => {
      dialog.showErrorBox("Không mở được Vận Hành", error.message);
      app.quit();
    });
}

async function encryptionAvailable() {
  const available = safeStorage.isAsyncEncryptionAvailable
    ? await safeStorage.isAsyncEncryptionAvailable()
    : safeStorage.isEncryptionAvailable();
  return (
    available &&
    !(
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
  );
}
const secureStorage = {
  available: encryptionAvailable,
  encrypt: (value) =>
    safeStorage.encryptStringAsync
      ? safeStorage.encryptStringAsync(value)
      : Promise.resolve(safeStorage.encryptString(value)),
  decrypt: (value) =>
    safeStorage.decryptStringAsync
      ? safeStorage.decryptStringAsync(value)
      : Promise.resolve(safeStorage.decryptString(value)),
};

function assertSender(event, setupOnly = false) {
  const url = event.senderFrame?.url || "";
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    !trustedFrame(url, setupOnly ? "" : origin, setupUrl)
  )
    throw new Error("Yêu cầu không đến từ cửa sổ ứng dụng.");
}
function progress(message) {
  if (window && !window.isDestroyed())
    window.webContents.send("desktop:progress", message);
}
function publicError(error) {
  if (error.code === "ER_ACCESS_DENIED_ERROR")
    return "Tài khoản hoặc mật khẩu MySQL không đúng.";
  if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(error.code))
    return "Không kết nối được MySQL. Kiểm tra dịch vụ MySQL Server, địa chỉ và cổng.";
  if (error.code === "ER_DBACCESS_DENIED_ERROR")
    return "Tài khoản MySQL chưa có quyền với CSDL đã chọn.";
  return (
    error.message ||
    "Không thể hoàn tất thao tác. Vui lòng kiểm tra lại cấu hình."
  );
}
async function canReusePassword() {
  if (!origin || !window || window.isDestroyed()) return false;
  try {
    const cookies = await window.webContents.session.cookies.get({
      url: origin + "/",
      name: "vanhanh_session",
    });
    const token = cookies[0]?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
    const response = await fetch(origin + "/api/auth/me", {
      headers: { Cookie: "vanhanh_session=" + token },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok && (await response.json()).user?.VaiTro === "admin";
  } catch {
    return false;
  }
}
async function withResolvedPassword(input) {
  const value = validateConnection(input);
  if (input.useSavedPassword && !value.password) {
    if (!(await canReusePassword()))
      throw new Error(
        "Vui lòng nhập lại mật khẩu MySQL khi chưa đăng nhập bằng quyền quản trị.",
      );
    const saved = activeConnection || (await store.load())?.connection;
    if (
      !saved ||
      value.host !== saved.host ||
      value.port !== saved.port ||
      value.user !== saved.user
    )
      throw new Error(
        "Vui lòng nhập lại mật khẩu khi thay máy chủ hoặc tài khoản MySQL.",
      );
    value.password = saved.password;
  }
  return value;
}
async function testDatabase(value) {
  const connection = await mysql.createConnection({
    host: value.host,
    port: value.port,
    user: value.user,
    password: value.password,
    charset: "utf8mb4",
    connectTimeout: 10000,
  });
  try {
    const [rows] = await connection.query("SELECT VERSION() AS version");
    const version = rows[0].version,
      numbers = version
        .match(/^(\d+)\.(\d+)\.(\d+)/)
        ?.slice(1)
        .map(Number);
    if (
      !numbers ||
      /mariadb/i.test(version) ||
      numbers[0] < 8 ||
      (numbers[0] === 8 && numbers[1] === 0 && numbers[2] < 16)
    )
      throw new Error("Ứng dụng cần MySQL 8.0.16 trở lên.");
    const [schemas] = await connection.execute(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?",
      [value.database],
    );
    return { version, databaseExists: schemas.length > 0 };
  } finally {
    await connection.end();
  }
}
async function initializeDatabase(value) {
  const connection = await mysql.createConnection({
    host: value.host,
    port: value.port,
    user: value.user,
    password: value.password,
    charset: "utf8mb4",
    connectTimeout: 10000,
  });
  try {
    const { executeSql } = await import(
      pathToFileURL(path.join(root, "server/services/sql-runner.js")).href
    );
    const source = (
      await readFile(path.join(root, "database/01_project5.sql"), "utf8")
    ).replaceAll("Project5_VanTai", value.database);
    await executeSql(connection, source);
    await executeSql(
      connection,
      await readFile(path.join(root, "database/02_app.sql"), "utf8"),
    );
  } finally {
    await connection.end();
  }
}
async function stopBackend() {
  const child = service;
  service = null;
  origin = "";
  if (!child) return;
  await new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      child.kill();
      done();
    }, 2800);
    child.once("exit", done);
    try {
      child.postMessage({ type: "shutdown" });
    } catch {
      child.kill();
      done();
    }
  });
}
async function startBackend(value) {
  await stopBackend();
  bootToken = randomBytes(24).toString("hex");
  const child = utilityProcess.fork(
    path.join(root, "desktop/backend-service.cjs"),
    [],
    {
      env: {
        ...process.env,
        DB_HOST: value.host,
        DB_PORT: String(value.port),
        DB_USER: value.user,
        DB_PASSWORD: value.password,
        DB_NAME: value.database,
        PORT: "0",
        HOST: "127.0.0.1",
        COOKIE_SECURE: "false",
        SETUP_TOKEN: bootToken,
        MAP_CACHE_FILE: path.join(app.getPath("userData"), "map-cache.json"),
        MAP_TILE_CACHE_DIR: path.join(app.getPath("userData"), "map-tiles"),
      },
      stdio: "ignore",
      serviceName: "Vận Hành – dữ liệu",
      partition: "persist:vanhanh-maps",
    },
  );
  service = child;
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Khởi động quá lâu. Hãy kiểm tra MySQL và thử lại."));
    }, 30000);
    const fail = (code) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Bộ xử lý chưa khởi động được (${code}). Kiểm tra cấu trúc CSDL.`,
        ),
      );
    };
    child.once("exit", fail);
    child.on("message", (message) => {
      if (message?.type === "ready") {
        clearTimeout(timer);
        child.removeListener("exit", fail);
        resolve(message);
      }
      if (message?.type === "error") {
        clearTimeout(timer);
        reject(
          Object.assign(new Error(message.message), { code: message.code }),
        );
        child.kill();
      }
    });
  });
  origin = `http://127.0.0.1:${ready.port}`;
  initialized = ready.initialized;
  activeConnection = value;
  child.on("exit", () => {
    if (service !== child || quitting) return;
    service = null;
    origin = "";
    lastError = "Bộ xử lý đã dừng. Vui lòng kiểm tra kết nối và mở lại.";
    if (window && !window.isDestroyed()) window.loadURL(setupUrl);
  });
}
function openApplication() {
  if (!origin || !window || window.isDestroyed()) return;
  const route = pendingTrip
    ? "/chuyen-xe?trip=" + encodeURIComponent(pendingTrip)
    : "/";
  pendingTrip = null;
  window.loadURL(origin + "/#" + route);
}
async function savePdf() {
  if (!origin || !window) return { saved: false };
  const result = await dialog.showSaveDialog(window, {
    title: "Lưu nội dung thành PDF",
    defaultPath: path.join(app.getPath("documents"), "VanHanh.pdf"),
    filters: [{ name: "Tài liệu PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  const bytes = await window.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    preferCSSPageSize: true,
  });
  await writeFile(result.filePath, bytes);
  return { saved: true };
}
function showSettings() {
  if (busy || !window) return;
  window.loadURL(setupUrl);
}
function createMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Tệp",
        submenu: [
          {
            label: "Kết nối MySQL…",
            accelerator: "CmdOrCtrl+,",
            click: showSettings,
          },
          { label: "Trở lại ứng dụng", click: openApplication },
          { type: "separator" },
          {
            label: "In…",
            accelerator: "CmdOrCtrl+P",
            click: () =>
              window?.webContents.print({
                silent: false,
                printBackground: true,
              }),
          },
          {
            label: "Lưu thành PDF…",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () =>
              savePdf().catch((error) =>
                dialog.showErrorBox("Không lưu được PDF", error.message),
              ),
          },
          { type: "separator" },
          {
            label: "Thoát",
            accelerator: "CmdOrCtrl+Q",
            click: () => app.quit(),
          },
        ],
      },
      {
        label: "Chỉnh sửa",
        submenu: [
          { role: "undo", label: "Hoàn tác" },
          { role: "redo", label: "Làm lại" },
          { type: "separator" },
          { role: "cut", label: "Cắt" },
          { role: "copy", label: "Sao chép" },
          { role: "paste", label: "Dán" },
          { role: "selectAll", label: "Chọn tất cả" },
        ],
      },
      {
        label: "Hiển thị",
        submenu: [
          { role: "resetZoom", label: "Cỡ mặc định" },
          { role: "zoomIn", label: "Phóng to" },
          { role: "zoomOut", label: "Thu nhỏ" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Toàn màn hình" },
        ],
      },
      {
        label: "Trợ giúp",
        submenu: [
          {
            label: "Hướng dẫn sử dụng",
            click: () => origin && window.loadURL(origin + "/#/huong-dan"),
          },
          {
            label: "Về Vận Hành",
            click: () =>
              dialog.showMessageBox(window, {
                type: "info",
                title: "Về ứng dụng",
                message: "Vận Hành Desktop",
                detail: `Phiên bản ${app.getVersion()}\nQuản lý vận tải hành khách đường dài – Project 5.\nReact · Tailwind CSS · Lucide · Electron · MySQL`,
              }),
          },
        ],
      },
    ]),
  );
}
async function launch() {
  const bootstrapHandler = await createBootstrapHandler(root);
  if (process.platform === "win32")
    app.setAppUserModelId("vn.project5.vanhanh");
  store = createConfigStore(
    path.join(app.getPath("userData"), "database.json"),
    secureStorage,
  );
  window = new BrowserWindow({
    title: "Vận Hành",
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#f6f8fc",
    show: false,
    icon: path.join(root, "assets/vanhanh.png"),
    webPreferences: {
      preload: path.join(root, "desktop/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: "vanhanh-runtime",
    },
  });
  window.once("ready-to-show", () => window.show());
  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("Vận Hành");
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (allowExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!trustedNavigation(url, origin, setupUrl, loadingUrl)) {
      event.preventDefault();
      if (allowExternal(url)) shell.openExternal(url);
    }
  });
  const session = window.webContents.session;
  session.protocol.handle(UI_SCHEME, bootstrapHandler);
  session.setPermissionCheckHandler(
    (contents, permission, requestingOrigin, details) =>
      contents === window.webContents &&
      permission === "media" &&
      requestingOrigin === origin &&
      details.mediaType !== "audio",
  );
  session.setPermissionRequestHandler(
    async (contents, permission, callback, details) => {
      if (
        contents !== window.webContents ||
        permission !== "media" ||
        !details.mediaTypes?.includes("video") ||
        details.mediaTypes.includes("audio") ||
        !trustedFrame(contents.getURL(), origin, setupUrl)
      )
        return callback(false);
      const answer = await dialog.showMessageBox(window, {
        type: "question",
        title: "Quét mã QR",
        message: "Cho phép Vận Hành dùng máy ảnh để quét mã QR?",
        detail: "Chỉ bật khi bạn quét mã. Ảnh được xử lý trên máy.",
        buttons: ["Cho phép", "Không cho phép"],
        defaultId: 1,
        cancelId: 1,
      });
      callback(answer.response === 0);
    },
  );
  session.on("will-download", (event, item) => {
    const url = item.getURL();
    if (
      !(
        origin &&
        (url.startsWith(origin + "/") || url.startsWith("blob:" + origin + "/"))
      ) &&
      !url.startsWith("data:image/png;base64,")
    ) {
      event.preventDefault();
      return;
    }
    const filename =
      item
        .getFilename()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .slice(0, 160) || "VanHanh-export";
    item.setSaveDialogOptions({
      title: "Lưu tệp từ Vận Hành",
      defaultPath: path.join(app.getPath("downloads"), filename),
    });
  });
  createMenu();
  registerIpc();
  try {
    await window.loadURL(loadingUrl);
  } catch (error) {
    console.warn(
      "Không hiển thị được màn hình chờ:",
      error.code || error.message,
    );
  }
  if (app.isPackaged)
    app.setAsDefaultProtocolClient(
      "vanhanh",
      process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    );
  try {
    const saved = await store.load();
    if (saved && !saved.needsPassword) {
      await startBackend(saved.connection);
      openApplication();
    } else {
      if (saved?.needsPassword)
        lastError = "Vui lòng nhập mật khẩu MySQL để mở ứng dụng.";
      await window.loadURL(setupUrl);
    }
  } catch (error) {
    lastError = publicError(error);
    await window.loadURL(setupUrl);
  }
}
function registerIpc() {
  ipcMain.handle("desktop:get-settings", async (event) => {
    assertSender(event);
    let saved;
    try {
      saved = await store.load();
    } catch (error) {
      lastError = error.message;
    }
    const connection =
      activeConnection || saved?.connection || configuration.defaults;
    return {
      host: connection.host,
      port: connection.port,
      user: connection.user,
      database: connection.database,
      hasPassword: !!connection.password && (await canReusePassword()),
      configured: !!saved,
      canRemember: await encryptionAvailable(),
      error: lastError,
      connected: !!origin,
      version: app.getVersion(),
    };
  });
  ipcMain.handle("desktop:test-connection", async (event, input) => {
    assertSender(event, true);
    try {
      return {
        ok: true,
        ...(await testDatabase(await withResolvedPassword(input))),
      };
    } catch (error) {
      return { ok: false, message: publicError(error) };
    }
  });
  ipcMain.handle("desktop:connect", async (event, input) => {
    assertSender(event, true);
    if (busy) return { ok: false, message: "Đang kết nối. Vui lòng chờ." };
    busy = true;
    try {
      const value = await withResolvedPassword(input);
      progress("Đang kiểm tra kết nối MySQL…");
      await testDatabase(value);
      if (input.initialize) {
        progress("Đang khởi tạo/nâng cấp cấu trúc, giữ dữ liệu hiện có…");
        await initializeDatabase(value);
      }
      progress("Đang khởi động bộ xử lý và làm mới số liệu…");
      await startBackend(value);
      await store.save(value, input.rememberPassword !== false);
      lastError = "";
      openApplication();
      return { ok: true };
    } catch (error) {
      await stopBackend();
      lastError = publicError(error);
      return { ok: false, message: lastError };
    } finally {
      busy = false;
    }
  });
  ipcMain.handle("desktop:configure", (event) => {
    assertSender(event);
    showSettings();
    return { ok: true };
  });
  ipcMain.handle("desktop:resume", (event) => {
    assertSender(event, true);
    openApplication();
    return { ok: !!origin };
  });
  ipcMain.handle("desktop:bootstrap", (event) => {
    assertSender(event);
    return { setupToken: !initialized && origin ? bootToken : null };
  });
  ipcMain.handle("desktop:print", (event) => {
    assertSender(event);
    window.webContents.print({ silent: false, printBackground: true });
    return { ok: true };
  });
  ipcMain.handle("desktop:save-pdf", (event) => {
    assertSender(event);
    return savePdf();
  });
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", async (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  await stopBackend();
  app.quit();
});
