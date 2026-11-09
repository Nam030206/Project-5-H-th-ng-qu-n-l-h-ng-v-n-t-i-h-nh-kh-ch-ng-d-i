import mysql from "mysql2/promise";
import { config } from "./index.js";
export const pool = mysql.createPool({
  ...config.mysql,
  database: config.database,
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: false,
});
pool.on("connection", (connection) =>
  connection.query("SET SESSION time_zone = '+07:00'"),
);
export async function transaction(callback, { business = false } = {}) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    if (business) {
      const [rows] = await connection.query(
        "SELECT GET_LOCK(?, 15) AS acquired",
        [`${config.database}.business`],
      );
      if (Number(rows[0].acquired) !== 1)
        throw Object.assign(
          new Error("Dữ liệu đang được cập nhật. Vui lòng thử lại."),
          { status: 409 },
        );
      locked = true;
    }
    await connection.beginTransaction();
    const value = await callback(connection);
    await connection.commit();
    return value;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked)
      await connection
        .query("SELECT RELEASE_LOCK(?)", [`${config.database}.business`])
        .catch(() => {});
    connection.release();
  }
}
