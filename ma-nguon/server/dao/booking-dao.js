import { pool } from "../config/database.js";
import { clock } from "./business-dao.js";
import { AppError, dateSchema, pagination } from "../services/validation.js";

export const publicTripFields = `c.MaSoChuyenXe,c.NgayThucHien,c.MaTuyen,c.BienSo,c.GiaVe,
  t.DiemDau,t.DiemCuoi,x.HangSanXuat,x.Model,x.SoChoNgoiQuyDinh`;
const tripFrom =
  "FROM CHUYEN_XE c JOIN TUYEN_DUONG t ON t.MaTuyen=c.MaTuyen JOIN XE_KHACH x ON x.BienSo=c.BienSo";

export async function findTrip(id, connection, lock = false) {
  const [rows] = await connection.execute(
    `SELECT ${publicTripFields},c.SoKhach ${tripFrom} WHERE c.MaSoChuyenXe=?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] || null;
}

export async function trips(query, user) {
  const { page, limit } = pagination(query),
    conditions = ["c.NgayThucHien>CURDATE()"],
    parameters = [];
  if (query.q) {
    conditions.push(
      "(c.MaSoChuyenXe LIKE ? OR t.DiemDau LIKE ? OR t.DiemCuoi LIKE ? OR c.MaTuyen LIKE ?)",
    );
    parameters.push(...Array(4).fill(`%${String(query.q).slice(0, 150)}%`));
  }
  const start = query.start ? dateSchema.parse(query.start) : null,
    end = query.end ? dateSchema.parse(query.end) : null;
  if (start && end && start > end)
    throw new AppError(
      422,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.",
    );
  if (start) {
    conditions.push("c.NgayThucHien>=?");
    parameters.push(start);
  }
  if (end) {
    conditions.push("c.NgayThucHien<=?");
    parameters.push(end);
  }
  if (query.available === "1") conditions.push("c.SoKhach<x.SoChoNgoiQuyDinh");
  const where = " WHERE " + conditions.join(" AND ");
  const [count] = await pool.query(
    `SELECT COUNT(*) AS total ${tripFrom}${where}`,
    parameters,
  );
  const [rows] = await pool.query(
    `SELECT ${publicTripFields},(x.SoChoNgoiQuyDinh-c.SoKhach) AS SoChoConLai,
    COALESCE((SELECT SoLuong FROM APP_DANG_KY_CHUYEN d WHERE d.MaSoChuyenXe=c.MaSoChuyenXe AND d.TaiKhoanId=? AND d.TrangThai='confirmed'),0) AS SoLuongDaDangKy
    ${tripFrom}${where} ORDER BY c.NgayThucHien,c.MaSoChuyenXe LIMIT ? OFFSET ?`,
    [user.Id, ...parameters, limit, (page - 1) * limit],
  );
  return {
    rows,
    total: Number(count[0].total),
    page,
    limit,
    clock: await clock(),
  };
}

export async function bookings(query, user, staff = false) {
  const { page, limit } = pagination(query),
    conditions = [],
    parameters = [];
  if (!staff) {
    conditions.push("d.TaiKhoanId=?");
    parameters.push(user.Id);
  }
  if (query.status) {
    if (!["confirmed", "cancelled"].includes(query.status))
      throw new AppError(422, "Trạng thái đăng ký không hợp lệ.");
    conditions.push("d.TrangThai=?");
    parameters.push(query.status);
  }
  if (query.q) {
    conditions.push(
      "(JSON_UNQUOTE(JSON_EXTRACT(d.ThongTinChuyen,'$.MaSoChuyenXe')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(d.ThongTinChuyen,'$.DiemDau')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(d.ThongTinChuyen,'$.DiemCuoi')) LIKE ?" +
        (staff ? " OR a.HoTen LIKE ? OR a.TenDangNhap LIKE ?" : "") +
        ")",
    );
    parameters.push(
      ...Array(staff ? 5 : 3).fill(`%${String(query.q).slice(0, 150)}%`),
    );
  }
  const source =
      "FROM APP_DANG_KY_CHUYEN d JOIN APP_TAI_KHOAN a ON a.Id=d.TaiKhoanId LEFT JOIN CHUYEN_XE c ON c.MaSoChuyenXe=d.MaSoChuyenXe",
    where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const [count] = await pool.query(
    `SELECT COUNT(*) AS total ${source}${where}`,
    parameters,
  );
  const [selected] = await pool.query(
    `SELECT d.*,${staff ? "a.HoTen,a.TenDangNhap," : ""}
    (d.TrangThai='confirmed' AND c.NgayThucHien>CURDATE()) AS CoTheHuy
    ${source}${where} ORDER BY d.NgayDangKy DESC,d.Id DESC LIMIT ? OFFSET ?`,
    [...parameters, limit, (page - 1) * limit],
  );
  const rows = selected.map(({ ThongTinChuyen, ...record }) => {
    const trip =
      typeof ThongTinChuyen === "string"
        ? JSON.parse(ThongTinChuyen)
        : ThongTinChuyen;
    return {
      ...trip,
      ...record,
      CoTheHuy: Number(record.CoTheHuy) === 1,
      MaSoChuyenXe: record.MaSoChuyenXe || trip.MaSoChuyenXe,
      GiaVe: record.GiaVeDangKy,
      ThanhTien: (
        BigInt(record.GiaVeDangKy) * BigInt(record.SoLuong)
      ).toString(),
    };
  });
  return {
    rows,
    total: Number(count[0].total),
    page,
    limit,
    clock: await clock(),
  };
}
