import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { ZodError } from "zod";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { pool } from "./config/database.js";
import { originGuard, requireAuth, roles } from "./middleware/auth.js";
import * as auth from "./controllers/auth-controller.js";
import * as business from "./controllers/business-controller.js";
import * as accounts from "./controllers/accounts-controller.js";
import * as bookings from "./controllers/booking-controller.js";
import { refreshDerived } from "./services/refresh-service.js";
import { AppError } from "./services/validation.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://tile.openstreetmap.org",
            "https://*.tile.openstreetmap.org",
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", originGuard);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    },
  });
  const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Đăng ký quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    },
  });
  app.get("/api/health", async (request, response) => {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: "MySQL", timezone: "+07:00" });
  });
  app.get("/api/auth/status", auth.status);
  app.post("/api/auth/setup", limiter, auth.setup);
  app.post("/api/auth/login", limiter, auth.login);
  app.post("/api/auth/register", registrationLimiter, auth.register);
  app.use("/api", requireAuth);
  app.get("/api/auth/me", auth.me);
  app.post("/api/auth/logout", auth.logout);
  app.get("/api/passenger/meta", roles("passenger"), bookings.meta);
  app.get("/api/passenger/trips", roles("passenger"), bookings.trips);
  app.get("/api/passenger/bookings", roles("passenger"), bookings.mine);
  app.post("/api/passenger/bookings", roles("passenger"), bookings.book);
  app.post(
    "/api/passenger/bookings/:id/cancel",
    roles("passenger"),
    bookings.cancelMine,
  );
  app.use("/api", roles("admin", "operator"));
  app.get("/api/maps/tiles/:provider/:z/:x/:y.png", business.mapTile);
  app.get("/api/maps/status/:provider", business.mapStatus);
  app.get("/api/bookings", bookings.list);
  app.post("/api/bookings/:id/cancel", bookings.cancel);
  app.use("/api", async (request, response, next) => {
    if (
      request.method === "GET" &&
      !request.path.startsWith("/accounts") &&
      !request.path.startsWith("/audit")
    )
      await refreshDerived();
    next();
  });
  app.get("/api/dashboard", business.getDashboard);
  app.get("/api/options", business.options);
  app.get("/api/schedule", async (request, response) => {
    const dao = await import("./dao/business-dao.js");
    response.json(await dao.list("trips", request.query, pool, true));
  });
  app.get("/api/entities/:entity/export", business.exportEntity);
  app.post(
    "/api/entities/:entity/import",
    roles("admin", "operator"),
    upload.single("file"),
    business.importFile,
  );
  app.get("/api/entities/:entity", business.list);
  app.get("/api/entities/:entity/:id", business.detail);
  app.post(
    "/api/entities/:entity",
    roles("admin", "operator"),
    business.create,
  );
  app.put(
    "/api/entities/:entity/:id",
    roles("admin", "operator"),
    business.update,
  );
  app.delete(
    "/api/entities/:entity/:id",
    roles("admin", "operator"),
    business.remove,
  );
  app.post(
    "/api/maintenance/:id",
    roles("admin", "operator"),
    business.maintain,
  );
  app.get("/api/reports/:type/export", business.exportReport);
  app.get("/api/reports/:type", business.getReport);
  app.get("/api/maps/:id", business.map);
  app.get("/api/accounts", roles("admin"), accounts.list);
  app.post("/api/accounts", roles("admin"), accounts.save);
  app.put("/api/accounts/:id", roles("admin"), accounts.save);
  app.get("/api/audit", roles("admin"), accounts.logs);
  app.post("/api/backups/export", roles("admin"), business.exportBackup);
  app.post(
    "/api/backups/preview",
    roles("admin"),
    upload.single("file"),
    business.previewBackup,
  );
  app.post(
    "/api/backups/restore",
    roles("admin"),
    upload.single("file"),
    business.restoreBackup,
  );
  app.use("/api", (request, response) =>
    response.status(404).json({ message: "Không tìm thấy chức năng." }),
  );
  const frontend = fileURLToPath(new URL("../dist/public", import.meta.url));
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
    app.get("/{*path}", (request, response) =>
      response.sendFile(frontend + "/index.html"),
    );
  }
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    let status = error.status || 500,
      message = error.message,
      details = error.details;
    if (error instanceof ZodError) {
      status = 422;
      message = "Vui lòng kiểm tra thông tin đã nhập.";
      details = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
    } else if (error.code === "ER_DUP_ENTRY") {
      status = 409;
      message = "Mã định danh hoặc tên đăng nhập đã tồn tại.";
    } else if (
      ["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)
    ) {
      status = 409;
      message =
        "Bản ghi đang được chuyến xe hoặc dữ liệu khác sử dụng, không thể xóa.";
    } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
      status = 422;
      message =
        "Xe, tuyến hoặc tài xế đã chọn không tồn tại. Hãy tải lại danh sách.";
    } else if (
      [
        "ER_CHECK_CONSTRAINT_VIOLATED",
        "ER_SIGNAL_EXCEPTION",
        "ER_DATA_TOO_LONG",
        "WARN_DATA_OUT_OF_RANGE",
      ].includes(error.code)
    ) {
      status = 422;
      message =
        error.sqlMessage ||
        "Dữ liệu không đáp ứng ràng buộc của cơ sở dữ liệu.";
    } else if (error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = "Tệp quá lớn. Kích thước tối đa 5 MB.";
    } else if (
      [
        "ECONNREFUSED",
        "ER_BAD_DB_ERROR",
        "ER_ACCESS_DENIED_ERROR",
        "ER_NO_SUCH_TABLE",
        "ER_SP_DOES_NOT_EXIST",
      ].includes(error.code)
    ) {
      status = 503;
      message =
        "Không kết nối được cơ sở dữ liệu. Hãy kiểm tra máy chủ hoặc liên hệ người quản trị.";
    } else if (
      error.code === "ER_LOCK_DEADLOCK" ||
      error.code === "ER_LOCK_WAIT_TIMEOUT"
    ) {
      status = 409;
      message = "Dữ liệu đang được cập nhật đồng thời. Vui lòng thử lại.";
    } else if (error.name === "AbortError" || error.name === "TimeoutError") {
      status = 503;
      message = "Dịch vụ bên ngoài phản hồi quá chậm. Vui lòng thử lại.";
    } else if (status >= 500 && !(error instanceof AppError)) {
      message =
        "Không thể hoàn tất thao tác. Vui lòng thử lại hoặc kiểm tra terminal server.";
      console.error(error.code || error.name, error.message);
    }
    response.status(status).json({ message, details });
  });
  return app;
}
