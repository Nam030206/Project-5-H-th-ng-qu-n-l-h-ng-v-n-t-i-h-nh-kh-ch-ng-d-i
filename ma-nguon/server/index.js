import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { pool } from "./config/database.js";
import { refreshDerived } from "./services/refresh-service.js";
import { ensureAppSchema } from "./services/app-schema-service.js";
const app = createApp();
try {
  await ensureAppSchema();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
  );
  if (Number(rows[0].total) === 0)
    console.log(`Mã thiết lập quản trị lần đầu: ${config.setupToken}`);
  await refreshDerived(true);
} catch (error) {
  console.error(
    "CSDL chưa sẵn sàng. Kiểm tra .env, bật MySQL và chạy npm run db:init.",
    error.code || "",
  );
}
const server = app.listen(config.port, config.host, () =>
  console.log(`Vận Hành API: http://${config.host}:${config.port}`),
);
const timer = setInterval(
  () =>
    refreshDerived().catch((error) =>
      console.error("Không làm mới được dữ liệu:", error.code || error.message),
    ),
  60000,
);
timer.unref();
async function shutdown() {
  clearInterval(timer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
