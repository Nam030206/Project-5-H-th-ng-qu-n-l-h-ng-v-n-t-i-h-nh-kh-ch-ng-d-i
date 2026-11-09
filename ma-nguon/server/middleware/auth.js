import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { pool } from "../config/database.js";
import { config } from "../config/index.js";
import { AppError } from "../services/validation.js";
export const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");
export const csrfFor = (token) => digest(`csrf:${token}`);
export function equal(left, right) {
  const a = Buffer.from(String(left)),
    b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function originGuard(request, response, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.get("origin");
    if (
      origin &&
      !config.origins.includes(origin) &&
      origin !== `${request.protocol}://${request.get("host")}`
    )
      return next(new AppError(403, "Nguồn yêu cầu không được phép."));
  }
  next();
}
export async function requireAuth(request, response, next) {
  const token = request.cookies.vanhanh_session;
  if (!token) throw new AppError(401, "Vui lòng đăng nhập để tiếp tục.");
  const [rows] = await pool.execute(
    `SELECT a.Id,a.TenDangNhap,a.HoTen,a.VaiTro,s.CsrfHash FROM APP_PHIEN_DANG_NHAP s JOIN APP_TAI_KHOAN a ON a.Id=s.TaiKhoanId WHERE s.TokenHash=? AND s.HetHan>NOW() AND a.HoatDong=1`,
    [digest(token)],
  );
  if (!rows.length)
    throw new AppError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  request.user = rows[0];
  request.sessionToken = token;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !equal(digest(request.get("x-csrf-token") || ""), rows[0].CsrfHash)
  )
    throw new AppError(
      403,
      "Phiên thao tác không hợp lệ. Vui lòng tải lại trang.",
    );
  next();
}
export const roles =
  (...allowed) =>
  (request, response, next) =>
    allowed.includes(request.user.VaiTro)
      ? next()
      : next(
          new AppError(403, "Tài khoản không có quyền thực hiện thao tác này."),
        );
export async function createSession(connection, user, response) {
  const token = randomBytes(32).toString("hex"),
    csrfToken = csrfFor(token);
  await connection.execute(
    "INSERT INTO APP_PHIEN_DANG_NHAP(TokenHash,TaiKhoanId,CsrfHash,HetHan) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))",
    [digest(token), user.Id, digest(csrfToken)],
  );
  response.cookie("vanhanh_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
  return {
    user: {
      Id: user.Id,
      TenDangNhap: user.TenDangNhap,
      HoTen: user.HoTen,
      VaiTro: user.VaiTro,
    },
    csrfToken,
  };
}
