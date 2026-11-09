const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function launch() {
  const root = path.join(__dirname, "..");
  const { net } = require("electron");
  const { createMapHttp } = require("./map-http.cjs");
  const mapRequest = createMapHttp(net);
  const { configureMapService } = await import(
    pathToFileURL(path.join(root, "server/services/map-service.js")).href
  );
  configureMapService({
    fetch: mapRequest,
    cacheFile: process.env.MAP_CACHE_FILE,
  });
  const { configureMapTiles } = await import(
    pathToFileURL(path.join(root, "server/services/map-tile-service.js")).href
  );
  configureMapTiles({
    fetch: mapRequest,
    cacheDirectory: process.env.MAP_TILE_CACHE_DIR,
  });
  const { createApp } = await import(
    pathToFileURL(path.join(root, "server/app.js")).href
  );
  const { pool } = await import(
    pathToFileURL(path.join(root, "server/config/database.js")).href
  );
  const { refreshDerived } = await import(
    pathToFileURL(path.join(root, "server/services/refresh-service.js")).href
  );
  const { ensureAppSchema } = await import(
    pathToFileURL(path.join(root, "server/services/app-schema-service.js")).href
  );
  await ensureAppSchema();
  const application = createApp();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
  );
  await refreshDerived(true);
  const server = application.listen(0, "127.0.0.1", () => {
    process.parentPort.postMessage({
      type: "ready",
      port: server.address().port,
      initialized: Number(rows[0].total) > 0,
    });
  });
  server.on("error", (error) =>
    process.parentPort.postMessage({
      type: "error",
      code: error.code,
      message: "Không khởi động được bộ xử lý nội bộ.",
    }),
  );
  const timer = setInterval(() => refreshDerived().catch(() => {}), 60000);
  timer.unref();
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 2500).unref();
  }
  process.parentPort.on("message", (event) => {
    if (event.data?.type === "shutdown") shutdown();
  });
  process.on("SIGTERM", shutdown);
}
launch().catch((error) => {
  process.parentPort.postMessage({
    type: "error",
    code: error.code || "STARTUP_ERROR",
    message:
      "Chưa kết nối được CSDL đầy đủ. Hãy kiểm tra MySQL hoặc chọn khởi tạo/nâng cấp cấu trúc.",
  });
  setTimeout(() => process.exit(1), 100);
});
