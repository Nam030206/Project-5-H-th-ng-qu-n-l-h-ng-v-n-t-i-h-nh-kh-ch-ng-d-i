import { z } from "zod";
import { transaction } from "../config/database.js";
import { clock } from "../dao/business-dao.js";
import { findTrip } from "../dao/booking-dao.js";
import { AppError } from "./validation.js";
import { audit } from "./audit-service.js";

const bookingSchema = z
  .object({
    MaSoChuyenXe: z.string().trim().min(1).max(10),
    SoLuong: z.coerce.number().int().min(1).max(32767),
    GiaVe: z.coerce.number().int().min(0).max(999999999999),
  })
  .strict();
const cancelSchema = z
  .object({ LyDoHuy: z.string().trim().max(255).optional() })
  .strict();

export async function book(input, user) {
  const values = bookingSchema.parse(input);
  return transaction(
    async (connection) => {
      const [accounts] = await connection.execute(
        "SELECT VaiTro,HoatDong FROM APP_TAI_KHOAN WHERE Id=? FOR SHARE",
        [user.Id],
      );
      if (accounts[0]?.VaiTro !== "passenger" || !accounts[0].HoatDong)
        throw new AppError(
          403,
          "Tài khoản hiện tại không có quyền đăng ký chuyến.",
        );
      const trip = await findTrip(values.MaSoChuyenXe, connection, true);
      if (!trip) throw new AppError(404, "Chuyến xe không còn tồn tại.");
      if (trip.NgayThucHien <= (await clock(connection)).today)
        throw new AppError(409, "Chỉ có thể đăng ký trước ngày khởi hành.");
      const [existing] = await connection.execute(
        "SELECT * FROM APP_DANG_KY_CHUYEN WHERE TaiKhoanId=? AND MaSoChuyenXe=? FOR UPDATE",
        [user.Id, values.MaSoChuyenXe],
      );
      if (existing[0]?.TrangThai === "confirmed")
        throw new AppError(
          409,
          "Bạn đã đăng ký chuyến này. Xem tại Chuyến đã đăng ký.",
        );
      if (Number(trip.GiaVe) !== values.GiaVe)
        throw new AppError(
          409,
          "Giá vé đã thay đổi. Vui lòng tải lại chuyến và xác nhận giá mới.",
        );
      const remaining = Number(trip.SoChoNgoiQuyDinh) - Number(trip.SoKhach);
      if (values.SoLuong > remaining)
        throw new AppError(
          409,
          `Chuyến hiện chỉ còn ${remaining} chỗ. Vui lòng chọn lại số chỗ.`,
        );
      const { SoKhach, ...snapshot } = trip;
      await connection.execute(
        "UPDATE CHUYEN_XE SET SoKhach=SoKhach+? WHERE MaSoChuyenXe=?",
        [values.SoLuong, trip.MaSoChuyenXe],
      );
      let id = existing[0]?.Id;
      if (id) {
        await connection.execute(
          "UPDATE APP_DANG_KY_CHUYEN SET SoLuong=?,GiaVeDangKy=?,TrangThai='confirmed',NgayDangKy=NOW(),NgayHuy=NULL,LyDoHuy=NULL,ThongTinChuyen=? WHERE Id=?",
          [values.SoLuong, trip.GiaVe, JSON.stringify(snapshot), id],
        );
      } else {
        const [insert] = await connection.execute(
          "INSERT INTO APP_DANG_KY_CHUYEN(TaiKhoanId,MaSoChuyenXe,SoLuong,GiaVeDangKy,ThongTinChuyen) VALUES(?,?,?,?,?)",
          [
            user.Id,
            trip.MaSoChuyenXe,
            values.SoLuong,
            trip.GiaVe,
            JSON.stringify(snapshot),
          ],
        );
        id = insert.insertId;
      }
      const result = {
        Id: id,
        MaSoChuyenXe: trip.MaSoChuyenXe,
        SoLuong: values.SoLuong,
        GiaVeDangKy: trip.GiaVe,
        ThanhTien: (BigInt(trip.GiaVe) * BigInt(values.SoLuong)).toString(),
        TrangThai: "confirmed",
      };
      await audit(
        connection,
        user,
        "BOOK",
        "APP_DANG_KY_CHUYEN",
        id,
        existing[0] || null,
        result,
      );
      return result;
    },
    { business: true },
  );
}

export async function cancel(id, input, user, staff = false) {
  const bookingId = z.coerce.number().int().positive().parse(id),
    values = cancelSchema.parse(input || {});
  return transaction(
    async (connection) => {
      const [rows] = await connection.execute(
        `SELECT * FROM APP_DANG_KY_CHUYEN WHERE Id=?${staff ? "" : " AND TaiKhoanId=?"} FOR UPDATE`,
        staff ? [bookingId] : [bookingId, user.Id],
      );
      const before = rows[0];
      if (!before) throw new AppError(404, "Không tìm thấy đăng ký của bạn.");
      if (before.TrangThai === "cancelled")
        return { cancelled: true, alreadyCancelled: true };
      const trip = before.MaSoChuyenXe
        ? await findTrip(before.MaSoChuyenXe, connection, true)
        : null;
      if (!trip || trip.NgayThucHien <= (await clock(connection)).today)
        throw new AppError(409, "Chỉ có thể hủy đăng ký trước ngày khởi hành.");
      if (Number(trip.SoKhach) < Number(before.SoLuong))
        throw new AppError(
          409,
          "Số khách của chuyến không khớp với đăng ký. Vui lòng liên hệ quản trị viên.",
        );
      const reason =
        values.LyDoHuy ||
        (staff ? "Nhà xe hủy đăng ký" : "Hành khách hủy đăng ký");
      await connection.execute(
        "UPDATE APP_DANG_KY_CHUYEN SET TrangThai='cancelled',NgayHuy=NOW(),LyDoHuy=? WHERE Id=?",
        [reason, bookingId],
      );
      await connection.execute(
        "UPDATE CHUYEN_XE SET SoKhach=SoKhach-? WHERE MaSoChuyenXe=?",
        [before.SoLuong, trip.MaSoChuyenXe],
      );
      await audit(
        connection,
        user,
        "CANCEL_BOOKING",
        "APP_DANG_KY_CHUYEN",
        bookingId,
        before,
        { TrangThai: "cancelled", LyDoHuy: reason },
      );
      return { cancelled: true };
    },
    { business: true },
  );
}

export async function cancelForTrip(connection, tripId, user) {
  const [rows] = await connection.execute(
    "SELECT * FROM APP_DANG_KY_CHUYEN WHERE MaSoChuyenXe=? AND TrangThai='confirmed' FOR UPDATE",
    [tripId],
  );
  for (const row of rows) {
    await connection.execute(
      "UPDATE APP_DANG_KY_CHUYEN SET TrangThai='cancelled',NgayHuy=NOW(),LyDoHuy='Nhà xe hủy chuyến' WHERE Id=?",
      [row.Id],
    );
    await audit(
      connection,
      user,
      "CANCEL_TRIP_BOOKING",
      "APP_DANG_KY_CHUYEN",
      row.Id,
      row,
      { TrangThai: "cancelled", LyDoHuy: "Nhà xe hủy chuyến" },
    );
  }
}

export async function prepareRestoreBookings(connection, backup) {
  const [rows] = await connection.query(
    "SELECT d.Id,d.MaSoChuyenXe,d.SoLuong,c.MaTuyen,c.BienSo,c.NgayThucHien,c.GiaVe,t.DiemDau,t.DiemCuoi FROM APP_DANG_KY_CHUYEN d JOIN CHUYEN_XE c ON c.MaSoChuyenXe=d.MaSoChuyenXe JOIN TUYEN_DUONG t ON t.MaTuyen=c.MaTuyen WHERE d.TrangThai='confirmed' AND c.NgayThucHien>CURDATE()",
  );
  const trips = new Map(
      backup.tables.trips.map((row) => [row.MaSoChuyenXe, row]),
    ),
    routes = new Map(backup.tables.routes.map((row) => [row.MaTuyen, row])),
    quantities = new Map();
  for (const row of rows)
    quantities.set(
      row.MaSoChuyenXe,
      (quantities.get(row.MaSoChuyenXe) || 0) + Number(row.SoLuong),
    );
  for (const row of rows) {
    const restored = trips.get(row.MaSoChuyenXe),
      route = restored ? routes.get(restored.MaTuyen) : null;
    if (
      !restored ||
      restored.MaTuyen !== row.MaTuyen ||
      restored.BienSo !== row.BienSo ||
      restored.NgayThucHien !== row.NgayThucHien ||
      Number(restored.GiaVe) !== Number(row.GiaVe) ||
      route?.DiemDau !== row.DiemDau ||
      route?.DiemCuoi !== row.DiemCuoi ||
      Number(restored.SoKhach) < quantities.get(row.MaSoChuyenXe)
    )
      throw new AppError(
        409,
        "Bản sao lưu không phù hợp với các chuyến đang có hành khách đăng ký. Không thể phục hồi vì sẽ làm mất hoặc thay đổi đăng ký hiện tại.",
      );
  }
  return rows.map((row) => ({ Id: row.Id, MaSoChuyenXe: row.MaSoChuyenXe }));
}
