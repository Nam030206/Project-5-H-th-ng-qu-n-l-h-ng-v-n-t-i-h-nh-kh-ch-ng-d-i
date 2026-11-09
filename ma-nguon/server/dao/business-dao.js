import { pool } from "../config/database.js";
import {
  entityConfig,
  pagination,
  dateSchema,
  AppError,
} from "../services/validation.js";
export const tripSelect = `SELECT t.*, td.DiemDau, td.DiemCuoi, td.DoPhucTap, td.DoDai,
  lx.Ten AS TenLaiXe, px.Ten AS TenPhuXe, x.SoChoNgoiQuyDinh
  FROM CHUYEN_XE t JOIN TUYEN_DUONG td ON td.MaTuyen=t.MaTuyen
  JOIN TAI_XE lx ON lx.CMT=t.CMTLaiXe JOIN TAI_XE px ON px.CMT=t.CMTPhuXe
  JOIN XE_KHACH x ON x.BienSo=t.BienSo`;
export async function clock(connection = pool) {
  const [rows] = await connection.query(
    "SELECT CURDATE() AS today, DATE_FORMAT(CURDATE(), '%Y-%m-01') AS monthStart, NOW() AS now",
  );
  return rows[0];
}
export function conditions(entity, query) {
  const config = entityConfig(entity),
    where = [],
    parameters = [];
  if (query.q) {
    const fields = [
      ...config.search.map((field) => `t.\`${field}\``),
      ...(entity === "trips"
        ? ["lx.Ten", "px.Ten", "td.DiemDau", "td.DiemCuoi"]
        : []),
    ];
    where.push(`(${fields.map((field) => `${field} LIKE ?`).join(" OR ")})`);
    for (const field of fields)
      parameters.push(`%${String(query.q).slice(0, 150)}%`);
  }
  for (const filter of config.filters)
    if (query[filter] !== undefined && query[filter] !== "") {
      where.push(`t.\`${filter}\`=?`);
      parameters.push(String(query[filter]));
    }
  if (entity === "trips") {
    if (query.start && query.end && query.start > query.end)
      throw new AppError(
        422,
        "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.",
      );
    if (query.start) {
      where.push("t.NgayThucHien>=?");
      parameters.push(dateSchema.parse(query.start));
    }
    if (query.end) {
      where.push("t.NgayThucHien<=?");
      parameters.push(dateSchema.parse(query.end));
    }
  }
  return {
    sql: where.length ? " WHERE " + where.join(" AND ") : "",
    parameters,
  };
}
export async function list(entity, query = {}, connection = pool, all = false) {
  const config = entityConfig(entity),
    { page, limit } = pagination(query),
    filter = conditions(entity, query);
  const source =
    entity === "trips"
      ? tripSelect.slice(tripSelect.indexOf("FROM CHUYEN_XE"))
      : `FROM \`${config.table}\` t`;
  const [count] = await connection.query(
    `SELECT COUNT(*) AS total ${source}${filter.sql}`,
    filter.parameters,
  );
  const selected =
    entity === "trips" ? tripSelect : `SELECT t.* FROM \`${config.table}\` t`;
  const order =
    entity === "trips"
      ? "t.NgayThucHien DESC,t.MaSoChuyenXe"
      : `t.\`${config.key}\``;
  const [rows] = await connection.query(
    `${selected}${filter.sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...filter.parameters, all ? 10000 : limit, all ? 0 : (page - 1) * limit],
  );
  return { rows, total: Number(count[0].total), page, limit };
}
export async function find(entity, id, connection = pool, lock = false) {
  const config = entityConfig(entity);
  const [rows] = await connection.query(
    `SELECT * FROM \`${config.table}\` WHERE \`${config.key}\`=?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] || null;
}
export async function insert(entity, values, connection) {
  const config = entityConfig(entity),
    fields = Object.keys(values);
  await connection.execute(
    `INSERT INTO \`${config.table}\` (${fields.map((f) => `\`${f}\``).join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
    fields.map((f) => values[f]),
  );
}
export async function update(entity, id, values, connection) {
  const config = entityConfig(entity),
    fields = Object.keys(values).filter((f) => f !== config.key);
  await connection.execute(
    `UPDATE \`${config.table}\` SET ${fields.map((f) => `\`${f}\`=?`).join(",")} WHERE \`${config.key}\`=?`,
    [...fields.map((f) => values[f]), id],
  );
}
export async function remove(entity, id, connection) {
  const config = entityConfig(entity);
  await connection.execute(
    `DELETE FROM \`${config.table}\` WHERE \`${config.key}\`=?`,
    [id],
  );
}
export async function history(entity, id) {
  const filter =
    entity === "buses"
      ? "t.BienSo=?"
      : entity === "drivers"
        ? "(t.CMTLaiXe=? OR t.CMTPhuXe=?)"
        : "t.MaTuyen=?";
  const [rows] = await pool.query(
    `${tripSelect} WHERE ${filter} ORDER BY t.NgayThucHien DESC,t.MaSoChuyenXe LIMIT 2000`,
    entity === "drivers" ? [id, id] : [id],
  );
  return rows;
}
