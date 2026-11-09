import { pool, transaction } from "../config/database.js";
import * as dao from "../dao/business-dao.js";
import { AppError, entityConfig, validate, dateSchema } from "./validation.js";
import { audit } from "./audit-service.js";
import { cancelForTrip } from "./booking-service.js";
export async function assertTripEditable(user, record, connection) {
  if (
    user.VaiTro !== "admin" &&
    record.NgayThucHien <= (await dao.clock(connection)).today
  )
    throw new AppError(
      403,
      "Nhân viên chỉ được điều chỉnh hoặc hủy chuyến có ngày thực hiện sau hôm nay. Quản trị viên có thể sửa dữ liệu lịch sử.",
    );
}
export async function save(entity, id, input, user) {
  const config = entityConfig(entity),
    values = validate(entity, input);
  if (id !== null && String(values[config.key]) !== String(id))
    throw new AppError(422, "Không được thay đổi khóa định danh của bản ghi.");
  return transaction(
    async (connection) => {
      const before =
        id === null ? null : await dao.find(entity, id, connection, true);
      if (id !== null && !before)
        throw new AppError(404, "Bản ghi không còn tồn tại.");
      if (entity === "trips" && before)
        await assertTripEditable(user, before, connection);
      if (id === null) await dao.insert(entity, values, connection);
      else await dao.update(entity, id, values, connection);
      const after = await dao.find(entity, values[config.key], connection);
      await audit(
        connection,
        user,
        id === null ? "CREATE" : "UPDATE",
        config.table,
        values[config.key],
        before,
        after,
      );
      return after;
    },
    { business: true },
  );
}
export async function destroy(entity, id, user) {
  const config = entityConfig(entity);
  return transaction(
    async (connection) => {
      const before = await dao.find(entity, id, connection, true);
      if (!before) throw new AppError(404, "Bản ghi không còn tồn tại.");
      if (user.VaiTro !== "admin") {
        if (entity !== "trips")
          throw new AppError(403, "Chỉ quản trị viên được xóa dữ liệu này.");
        await assertTripEditable(user, before, connection);
      }
      if (entity === "trips") await cancelForTrip(connection, id, user);
      await dao.remove(entity, id, connection);
      await audit(connection, user, "DELETE", config.table, id, before, null);
    },
    { business: true },
  );
}
export async function maintenance(id, input, user) {
  const date = dateSchema.parse(input.date);
  return transaction(
    async (connection) => {
      const before = await dao.find("buses", id, connection, true);
      if (!before) throw new AppError(404, "Không tìm thấy xe.");
      const current = await dao.clock(connection);
      if (date > current.today)
        throw new AppError(
          422,
          "Ngày đã bảo dưỡng không được nằm trong tương lai.",
        );
      await connection.execute(
        "UPDATE XE_KHACH SET NgayBaoDuongCuoiCung=? WHERE BienSo=?",
        [date, id],
      );
      const after = await dao.find("buses", id, connection);
      await audit(
        connection,
        user,
        "MAINTENANCE",
        "XE_KHACH",
        id,
        before,
        after,
      );
      return after;
    },
    { business: true },
  );
}
export async function options() {
  const [[buses], [drivers], [routes]] = await Promise.all([
    pool.query(
      "SELECT BienSo,HangSanXuat,Model,SoGhe,SoChoNgoiQuyDinh FROM XE_KHACH ORDER BY BienSo",
    ),
    pool.query("SELECT CMT,Ten,LoaiBangLai FROM TAI_XE ORDER BY Ten,CMT"),
    pool.query("SELECT * FROM TUYEN_DUONG ORDER BY MaTuyen"),
  ]);
  return { buses, drivers, routes, clock: await dao.clock() };
}
