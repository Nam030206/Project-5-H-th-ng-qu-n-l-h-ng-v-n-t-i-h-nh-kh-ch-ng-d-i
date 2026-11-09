const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { registerHooks } = require("node:module");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { SETUP_URL, LOADING_URL, UI_SCHEME } = require("../bootstrap.cjs");

async function run() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "vanhanh-startup-"),
  );
  const state = {
    ready: false,
    privileged: false,
    handler: null,
    urls: [],
    windows: [],
    ipc: new Map(),
  };
  let complete, failed;
  const finished = new Promise((resolve, reject) => {
    complete = resolve;
    failed = reject;
  });
  const timeout = setTimeout(
    () => failed(new Error("Không đến được màn hình cấu hình")),
    5000,
  );
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    requestSingleInstanceLock: () => true,
    getAppPath: () => path.resolve(__dirname, "../.."),
    getPath: () => directory,
    isPackaged: false,
    getVersion: () => "1.3.1",
    whenReady: () => {
      state.ready = true;
      return Promise.resolve();
    },
    quit: () => failed(new Error("Ứng dụng đóng trước khi hiển thị cấu hình")),
  });
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      state.windows.push(this);
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: "about:blank" };
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = () => {};
      this.webContents.getURL = () => this.webContents.mainFrame.url;
      this.webContents.session = {
        protocol: {
          handle: (scheme, handler) => {
            assert.equal(scheme, UI_SCHEME);
            assert.ok(state.ready);
            state.handler = handler;
          },
        },
        setPermissionCheckHandler() {},
        setPermissionRequestHandler() {},
        on() {},
      };
    }
    isDestroyed() {
      return false;
    }
    show() {}
    setTitle() {}
    async loadFile() {
      throw new Error("Không được tải HTML bằng file URL");
    }
    async loadURL(url) {
      assert.ok(
        state.handler,
        "Đăng ký protocol trên đúng session trước khi tải trang",
      );
      assert.ok(!url.startsWith("file:"));
      state.urls.push(url);
      if (url === LOADING_URL && process.argv[2] === "splash-fails")
        throw Object.assign(new Error("ERR_FAILED (-2)"), {
          code: "ERR_FAILED",
        });
      const response = await state.handler(new Request(url));
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes("Vận Hành"));
      this.webContents.mainFrame.url = url;
      if (url === SETUP_URL) complete();
    }
  }
  global.__startupElectron = {
    app,
    BrowserWindow,
    protocol: {
      registerSchemesAsPrivileged: (schemes) => {
        assert.equal(state.ready, false);
        assert.equal(schemes[0].scheme, UI_SCHEME);
        assert.equal(schemes[0].privileges.standard, true);
        assert.equal(schemes[0].privileges.secure, true);
        assert.notEqual(schemes[0].privileges.bypassCSP, true);
        state.privileged = true;
      },
    },
    Menu: { buildFromTemplate: (x) => x, setApplicationMenu() {} },
    dialog: { showErrorBox: (_title, message) => failed(new Error(message)) },
    ipcMain: { handle: (name, handler) => state.ipc.set(name, handler) },
    safeStorage: { isAsyncEncryptionAvailable: async () => false },
    shell: {},
    utilityProcess: {
      fork: () => {
        throw new Error("Không khởi động backend khi chưa cấu hình MySQL");
      },
    },
  };
  const exportsCode =
    "export const {app,BrowserWindow,Menu,dialog,ipcMain,safeStorage,shell,utilityProcess,protocol}=globalThis.__startupElectron;";
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "electron"
        ? {
            url: "data:text/javascript," + encodeURIComponent(exportsCode),
            shortCircuit: true,
          }
        : next(specifier, context);
    },
  });
  try {
    await import(pathToFileURL(path.resolve(__dirname, "../main.mjs")).href);
    await finished;
    assert.ok(state.privileged);
    assert.deepEqual(state.urls, [LOADING_URL, SETUP_URL]);
    const window = state.windows[0];
    assert.equal(window.options.webPreferences.sandbox, true);
    assert.equal(window.options.webPreferences.contextIsolation, true);
    assert.equal(window.options.webPreferences.nodeIntegration, false);
    assert.equal(window.options.webPreferences.webSecurity, true);
    const event = {
      sender: window.webContents,
      senderFrame: window.webContents.mainFrame,
    };
    const settings = await state.ipc.get("desktop:get-settings")(event);
    assert.equal(settings.database, "Project5_VanTai");
    assert.equal(settings.connected, false);
    assert.ok(!Object.hasOwn(settings, "password"));
    window.webContents.mainFrame.url = LOADING_URL;
    await assert.rejects(
      state.ipc.get("desktop:get-settings")(event),
      /không đến từ cửa sổ/,
    );
    console.log("STARTUP_OK " + process.argv[2]);
  } finally {
    clearTimeout(timeout);
    hooks.deregister();
    await fs.rm(directory, { recursive: true, force: true });
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
