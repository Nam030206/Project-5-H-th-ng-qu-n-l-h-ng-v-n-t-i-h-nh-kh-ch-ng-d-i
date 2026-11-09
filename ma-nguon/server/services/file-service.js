import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { pool, transaction } from "../config/database.js";
import * as dao from "../dao/business-dao.js";
import { entities, entityConfig, validate, AppError } from "./validation.js";
import { audit } from "./audit-service.js";
import { confirmPassword } from "../controllers/auth-controller.js";
import { assertTripEditable } from "./business-service.js";
const generated = new Set([
  "SoChoNgoiQuyDinh",
  "NgayBaoDuongTiepTheo",
  "LuongThangHienTai",
  "DoanhThuChuyen",
]);
const headerNames = {
  BienSo: "Biển số",
  MauXe: "Màu xe",
  HangSanXuat: "Hãng sản xuất",
  DoiXe: "Đời xe",
  Model: "Model",
  SoGhe: "Số ghế",
  SoNamSuDung: "Số năm sử dụng",
  NgayBaoDuongCuoiCung: "Bảo dưỡng gần nhất",
  CMT: "CMT",
  Ten: "Họ và tên",
  MaSoBangLai: "Số bằng lái",
  LoaiBangLai: "Loại bằng lái",
  DiaChi: "Địa chỉ",
  NgaySinh: "Ngày sinh",
  ThamNien: "Thâm niên",
  MaTuyen: "Mã tuyến",
  DiemDau: "Điểm đầu",
  DiemCuoi: "Điểm cuối",
  DoDai: "Độ dài (km)",
  DoPhucTap: "Độ phức tạp",
  MaSoChuyenXe: "Mã chuyến",
  CMTLaiXe: "Lái chính",
  CMTPhuXe: "Phụ xe",
  NgayThucHien: "Ngày thực hiện",
  SoKhach: "Số khách",
  GiaVe: "Giá vé",
};
const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
export function inputFields(entity, row) {
  const fields = Object.keys(entities[entity].schema.shape),
    aliases = new Map(
      fields.flatMap((key) => [
        [normalize(key), key],
        [normalize(headerNames[key] || key), key],
      ]),
    );
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => aliases.has(normalize(key)))
      .map(([key, value]) => [aliases.get(normalize(key)), value]),
  );
}
export function editableRecord(entity, row) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !generated.has(key)),
  );
}
function jsonCell(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("richText" in value)
      return value.richText.map((part) => part.text).join("");
    if ("text" in value) return value.text;
    throw new AppError(
      422,
      "Tệp chứa ô công thức hoặc định dạng không hỗ trợ. Hãy chuyển ô sang giá trị.",
    );
  }
  return value ?? "";
}
export async function readRows(file) {
  if (!file) throw new AppError(422, "Vui lòng chọn tệp.");
  const extension = file.originalname.split(".").at(-1).toLowerCase();
  if (extension === "csv")
    return parse(file.buffer.toString("utf8"), {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      max_record_size: 100000,
    });
  if (extension !== "xlsx")
    throw new AppError(422, "Chỉ hỗ trợ tệp .xlsx hoặc .csv.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(422, "Tệp không có trang dữ liệu.");
  if (sheet.rowCount > 2001 || sheet.columnCount > 60)
    throw new AppError(422, "Mỗi lần nhập tối đa 2.000 dòng và 60 cột.");
  const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((value) => String(jsonCell(value)).trim()),
    rows = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const values = {};
    headers.forEach((key, column) => {
      if (key) values[key] = jsonCell(row.getCell(column + 1).value);
    });
    rows.push(values);
  });
  return rows;
}
export async function importRows(entity, file, user) {
  const config = entityConfig(entity);
  let rows;
  try {
    rows = await readRows(file);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      422,
      "Không đọc được tệp. Kiểm tra định dạng CSV/Excel và hàng tiêu đề.",
    );
  }
  if (!rows.length || rows.length > 2000)
    throw new AppError(422, "Tệp phải có từ 1 đến 2.000 dòng dữ liệu.");
  const validated = [],
    errors = [];
  rows.forEach((row, index) => {
    try {
      validated.push(validate(entity, inputFields(entity, row)));
    } catch (error) {
      errors.push({
        row: index + 2,
        message:
          error.issues
            ?.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ") || error.message,
      });
    }
  });
  if (errors.length)
    throw new AppError(
      422,
      `Có ${errors.length} dòng không hợp lệ. Chưa nhập dòng nào.`,
      errors.slice(0, 30),
    );
  await transaction(
    async (connection) => {
      for (let index = 0; index < validated.length; index++) {
        try {
          await dao.insert(entity, validated[index], connection);
        } catch (error) {
          error.details = [
            { row: index + 2, message: error.sqlMessage || error.message },
          ];
          throw error;
        }
      }
      await audit(connection, user, "IMPORT", config.table, null, null, {
        soDong: validated.length,
        tenTep: file.originalname,
      });
    },
    { business: true },
  );
  return { imported: validated.length };
}
export async function workbookBuffer(rows, format = "xlsx") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vận Hành";
  const sheet = workbook.addWorksheet("Du lieu"),
    keys = rows.length ? Object.keys(rows[0]) : ["ThongBao"];
  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.min(34, Math.max(18, key.length + 3)),
  }));
  for (const row of rows)
    sheet.addRow(
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === "string" && /^[=+\-@]/.test(value)
            ? "'" + value
            : value,
        ]),
      ),
    );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: keys.length },
  };
  if (format === "csv")
    return Buffer.concat([
      Buffer.from("\uFEFF"),
      await workbook.csv.writeBuffer(),
    ]);
  return workbook.xlsx.writeBuffer();
}
export function checksum(data) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
export async function backup(user, password) {
  return transaction(
    async (connection) => {
      await confirmPassword(connection, user, password);
      const tables = {};
      for (const [entity, config] of Object.entries(entities)) {
        const [rows] = await connection.query(
          `SELECT * FROM \`${config.table}\` ORDER BY \`${config.key}\``,
        );
        tables[entity] = rows.map((row) => editableRecord(entity, row));
      }
      const data = {
        format: "vanhanh-business-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        tables,
      };
      await audit(connection, user, "BACKUP", "BUSINESS_DATA", null, null, {
        counts: Object.fromEntries(
          Object.entries(tables).map(([key, rows]) => [key, rows.length]),
        ),
      });
      return { ...data, checksum: checksum(data) };
    },
    { business: true },
  );
}
export function parseBackup(file) {
  if (!file) throw new AppError(422, "Vui lòng chọn tệp sao lưu JSON.");
  let data;
  try {
    data = JSON.parse(file.buffer.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new AppError(422, "Tệp không phải JSON hợp lệ.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError(422, "Tệp không phải bản sao lưu Vận Hành.");
  const { checksum: expected, ...payload } = data;
  if (
    payload.format !== "vanhanh-business-backup" ||
    payload.version !== 1 ||
    typeof expected !== "string" ||
    checksum(payload) !== expected
  )
    throw new AppError(422, "Tệp sai định dạng hoặc mã kiểm tra không khớp.");
  const validated = {};
  for (const entity of Object.keys(entities)) {
    if (
      !Array.isArray(payload.tables?.[entity]) ||
      payload.tables[entity].length > 20000
    )
      throw new AppError(422, "Tệp thiếu bảng hoặc vượt quá 20.000 dòng/bảng.");
    const keys = new Set();
    validated[entity] = payload.tables[entity].map((row) => {
      const value = validate(entity, row),
        key = value[entities[entity].key];
      if (keys.has(key))
        throw new AppError(
          422,
          `Khóa trùng trong bảng ${entities[entity].table}.`,
        );
      keys.add(key);
      return value;
    });
  }
  const buses = new Map(validated.buses.map((row) => [row.BienSo, row])),
    drivers = new Set(validated.drivers.map((row) => row.CMT)),
    routes = new Set(validated.routes.map((row) => row.MaTuyen));
  for (const trip of validated.trips)
    if (
      !buses.has(trip.BienSo) ||
      !routes.has(trip.MaTuyen) ||
      !drivers.has(trip.CMTLaiXe) ||
      !drivers.has(trip.CMTPhuXe) ||
      trip.SoKhach > buses.get(trip.BienSo).SoGhe - 2
    )
      throw new AppError(
        422,
        `Chuyến ${trip.MaSoChuyenXe} có tham chiếu hoặc số khách không hợp lệ.`,
      );
  return {
    tables: validated,
    createdAt: payload.createdAt,
    counts: Object.fromEntries(
      Object.entries(validated).map(([key, rows]) => [key, rows.length]),
    ),
  };
}
export async function restore(file, password, confirmation, user) {
  if (confirmation !== "PHUC HOI")
    throw new AppError(422, "Nhập chính xác PHUC HOI để xác nhận.");
  const backup = parseBackup(file);
  await transaction(
    async (connection) => {
      await confirmPassword(connection, user, password);
      const { prepareRestoreBookings } = await import("./booking-service.js");
      const bookingLinks = await prepareRestoreBookings(connection, backup);
      for (const entity of ["trips", "routes", "drivers", "buses"])
        await connection.query(`DELETE FROM \`${entities[entity].table}\``);
      for (const entity of ["buses", "drivers", "routes", "trips"])
        for (const row of backup.tables[entity])
          await dao.insert(entity, row, connection);
      for (const link of bookingLinks)
        await connection.execute(
          "UPDATE APP_DANG_KY_CHUYEN SET MaSoChuyenXe=? WHERE Id=?",
          [link.MaSoChuyenXe, link.Id],
        );
      await connection.query("CALL P5_CapNhatNgayBaoDuong()");
      await connection.query("CALL P5_CapNhatLuongThang()");
      await audit(
        connection,
        user,
        "RESTORE",
        "BUSINESS_DATA",
        null,
        null,
        backup.counts,
      );
    },
    { business: true },
  );
  return { restored: true, counts: backup.counts };
}
