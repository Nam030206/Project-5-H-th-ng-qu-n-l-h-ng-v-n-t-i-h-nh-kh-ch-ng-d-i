import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, transaction } from "../config/database.js";
import { config } from "../config/index.js";
import {
  AppError,
  accountSchema,
  registrationSchema,
} from "../services/validation.js";
import { audit } from "../services/audit-service.js";
import { createSession, csrfFor, digest, equal } from "../middleware/auth.js";
export async function status(request, response) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
  );
  response.json({ initialized: Number(rows[0].total) > 0 });
}
export async function setup(request, response) {
  if (!equal(request.body.setupToken || "", config.setupToken))
    throw new AppError(
      403,
      "Mã thiết lập không đúng. Xem mã trong terminal đang chạy server.",
    );
  const input = accountSchema.parse({
    ...request.body.account,
    VaiTro: "admin",
    HoatDong: true,
  });
  if (Buffer.byteLength(input.MatKhau) > 72)
    throw new AppError(422, "Mật khẩu quá dài. Vui lòng rút ngắn.");
  const hash = await bcrypt.hash(input.MatKhau, 12);
  const result = await transaction(
    async (connection) => {
      const [count] = await connection.query(
        "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
      );
      if (Number(count[0].total) > 0)
        throw new AppError(
          409,
          "Hệ thống đã có quản trị viên. Vui lòng đăng nhập.",
        );
      const [insert] = await connection.execute(
        "INSERT INTO APP_TAI_KHOAN(TenDangNhap,HoTen,MatKhauHash,VaiTro) VALUES(?,?,?,?)",
        [input.TenDangNhap, input.HoTen, hash, "admin"],
      );
      const user = {
        Id: insert.insertId,
        TenDangNhap: input.TenDangNhap,
        HoTen: input.HoTen,
        VaiTro: "admin",
      };
      await audit(connection, user, "SETUP", "APP_TAI_KHOAN", user.Id, null, {
        TenDangNhap: user.TenDangNhap,
        VaiTro: "admin",
      });
      return createSession(connection, user, response);
    },
    { business: true },
  );
  response.status(201).json(result);
}
export async function login(request, response) {
  const input = z
    .object({
      username: z.string().trim().min(1).max(50),
      password: z.string().min(1).max(200),
    })
    .parse(request.body);
  const [rows] = await pool.execute(
    "SELECT * FROM APP_TAI_KHOAN WHERE TenDangNhap=? AND HoatDong=1",
    [input.username],
  );
  if (
    !rows.length ||
    !(await bcrypt.compare(input.password, rows[0].MatKhauHash))
  )
    throw new AppError(401, "Tên đăng nhập hoặc mật khẩu không đúng.");
  const result = await transaction(async (connection) => {
    await connection.query(
      "DELETE FROM APP_PHIEN_DANG_NHAP WHERE HetHan<NOW()",
    );
    await audit(connection, rows[0], "LOGIN", "APP_TAI_KHOAN", rows[0].Id);
    return createSession(connection, rows[0], response);
  });
  response.json(result);
}
export async function register(request, response) {
  const input = registrationSchema.parse(request.body);
  if (Buffer.byteLength(input.MatKhau, "utf8") > 72)
    throw new AppError(
      422,
      "Mật khẩu tối đa 72 byte UTF-8. Vui lòng rút ngắn mật khẩu có dấu hoặc emoji.",
    );
  const hash = await bcrypt.hash(input.MatKhau, 12);
  let user;
  try {
    user = await transaction(
      async (connection) => {
        const [admins] = await connection.query(
          "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN WHERE VaiTro='admin' AND HoatDong=1",
        );
        if (!Number(admins[0].total))
          throw new AppError(
            409,
            "Hệ thống cần được thiết lập quản trị viên trước khi mở đăng ký.",
          );
        const [insert] = await connection.execute(
          "INSERT INTO APP_TAI_KHOAN(TenDangNhap,HoTen,MatKhauHash,VaiTro,HoatDong) VALUES(?,?,?,'passenger',1)",
          [input.TenDangNhap, input.HoTen, hash],
        );
        const account = {
          Id: insert.insertId,
          TenDangNhap: input.TenDangNhap,
          HoTen: input.HoTen,
          VaiTro: "passenger",
        };
        await audit(
          connection,
          account,
          "REGISTER",
          "APP_TAI_KHOAN",
          account.Id,
          null,
          {
            TenDangNhap: account.TenDangNhap,
            VaiTro: "passenger",
            HoatDong: true,
          },
        );
        return account;
      },
      { business: true },
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      throw new AppError(
        409,
        "Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.",
      );
    throw error;
  }
  response.status(201).json({
    message: "Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.",
    user,
  });
}
export async function me(request, response) {
  const { CsrfHash, ...user } = request.user;
  response.json({ user, csrfToken: csrfFor(request.sessionToken) });
}
export async function logout(request, response) {
  await pool.execute("DELETE FROM APP_PHIEN_DANG_NHAP WHERE TokenHash=?", [
    digest(request.sessionToken),
  ]);
  response.clearCookie("vanhanh_session", {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
  });
  response.json({ ok: true });
}
export async function confirmPassword(connection, user, password) {
  const [rows] = await connection.execute(
    "SELECT MatKhauHash FROM APP_TAI_KHOAN WHERE Id=?",
    [user.Id],
  );
  if (
    !rows.length ||
    typeof password !== "string" ||
    !(await bcrypt.compare(password, rows[0].MatKhauHash))
  )
    throw new AppError(403, "Mật khẩu xác nhận không đúng.");
}
