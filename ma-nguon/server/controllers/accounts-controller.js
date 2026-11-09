import bcrypt from "bcryptjs";
import { pool, transaction } from "../config/database.js";
import { accountSchema, pagination, AppError } from "../services/validation.js";
import { audit } from "../services/audit-service.js";
export async function list(request, response) {
  const { page, limit } = pagination(request.query),
    term = `%${String(request.query.q || "").slice(0, 100)}%`;
  const [count] = await pool.execute(
    "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN WHERE TenDangNhap LIKE ? OR HoTen LIKE ?",
    [term, term],
  );
  const [rows] = await pool.query(
    "SELECT Id,TenDangNhap,HoTen,VaiTro,HoatDong,NgayTao FROM APP_TAI_KHOAN WHERE TenDangNhap LIKE ? OR HoTen LIKE ? ORDER BY Id LIMIT ? OFFSET ?",
    [term, term, limit, (page - 1) * limit],
  );
  response.json({ rows, total: Number(count[0].total), page, limit });
}
export async function save(request, response) {
  const id = request.params.id ? Number(request.params.id) : null;
  const schema = id
    ? accountSchema.extend({ MatKhau: accountSchema.shape.MatKhau.optional() })
    : accountSchema;
  const input = schema.parse(request.body);
  if (input.MatKhau && Buffer.byteLength(input.MatKhau) > 72)
    throw new AppError(422, "Mật khẩu quá dài. Vui lòng rút ngắn.");
  const hash = input.MatKhau ? await bcrypt.hash(input.MatKhau, 12) : null;
  await transaction(async (connection) => {
    const [all] = await connection.query(
      "SELECT Id,VaiTro,HoatDong FROM APP_TAI_KHOAN ORDER BY Id FOR UPDATE",
    );
    const before = id ? all.find((row) => Number(row.Id) === id) : null;
    if (id && !before) throw new AppError(404, "Không tìm thấy tài khoản.");
    if (
      id === Number(request.user.Id) &&
      (!input.HoatDong || input.VaiTro !== "admin")
    )
      throw new AppError(
        422,
        "Bạn không thể tự khóa hoặc hạ quyền tài khoản quản trị đang sử dụng.",
      );
    if (
      before?.VaiTro === "admin" &&
      before.HoatDong &&
      (!input.HoatDong || input.VaiTro !== "admin") &&
      all.filter((row) => row.VaiTro === "admin" && row.HoatDong).length < 2
    )
      throw new AppError(
        422,
        "Hệ thống cần ít nhất một quản trị viên đang hoạt động.",
      );
    let savedId = id;
    if (id) {
      await connection.execute(
        "UPDATE APP_TAI_KHOAN SET TenDangNhap=?,HoTen=?,VaiTro=?,HoatDong=? WHERE Id=?",
        [input.TenDangNhap, input.HoTen, input.VaiTro, input.HoatDong, id],
      );
      if (hash)
        await connection.execute(
          "UPDATE APP_TAI_KHOAN SET MatKhauHash=? WHERE Id=?",
          [hash, id],
        );
      if (hash || !input.HoatDong || before.VaiTro !== input.VaiTro)
        await connection.execute(
          "DELETE FROM APP_PHIEN_DANG_NHAP WHERE TaiKhoanId=?",
          [id],
        );
    } else {
      const [result] = await connection.execute(
        "INSERT INTO APP_TAI_KHOAN(TenDangNhap,HoTen,MatKhauHash,VaiTro,HoatDong) VALUES(?,?,?,?,?)",
        [input.TenDangNhap, input.HoTen, hash, input.VaiTro, input.HoatDong],
      );
      savedId = result.insertId;
    }
    const { MatKhau, ...safe } = input;
    await audit(
      connection,
      request.user,
      id ? "UPDATE" : "CREATE",
      "APP_TAI_KHOAN",
      savedId,
      before,
      safe,
    );
  });
  response.status(id ? 200 : 201).json({ ok: true });
}
export async function logs(request, response) {
  const { page, limit } = pagination(request.query),
    term = `%${String(request.query.q || "").slice(0, 100)}%`,
    where = " WHERE NguoiThucHien LIKE ? OR DoiTuong LIKE ? OR MaBanGhi LIKE ?";
  const parameters = [term, term, term];
  const [count] = await pool.execute(
    "SELECT COUNT(*) AS total FROM APP_NHAT_KY" + where,
    parameters,
  );
  const [rows] = await pool.query(
    "SELECT * FROM APP_NHAT_KY" + where + " ORDER BY Id DESC LIMIT ? OFFSET ?",
    [...parameters, limit, (page - 1) * limit],
  );
  response.json({ rows, total: Number(count[0].total), page, limit });
}
