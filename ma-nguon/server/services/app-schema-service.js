import { readFile } from "node:fs/promises";
import { pool } from "../config/database.js";
import { config } from "../config/index.js";
import { executeSql } from "./sql-runner.js";
import { AppError } from "./validation.js";

async function current(connection) {
  const [columns] = await connection.query(
    "SELECT COLUMN_TYPE,COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='APP_TAI_KHOAN' AND COLUMN_NAME='VaiTro'",
  );
  const [tables] = await connection.query(
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='APP_DANG_KY_CHUYEN'",
  );
  const [triggers] = await connection.query(
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('p5_app_chuyen_bu','p5_app_tuyen_bu')",
  );
  return (
    columns[0]?.COLUMN_TYPE === "enum('admin','operator','passenger')" &&
    columns[0]?.COLUMN_DEFAULT === "passenger" &&
    Number(tables[0].total) === 1 &&
    Number(triggers[0].total) === 2
  );
}

export async function ensureAppSchema() {
  const connection = await pool.getConnection();
  const locks = [];
  try {
    if (await current(connection)) return;
    for (const suffix of ["schema", "business"]) {
      const name = `${config.database}.${suffix}`;
      const [rows] = await connection.query(
        "SELECT GET_LOCK(?,15) AS acquired",
        [name],
      );
      if (Number(rows[0].acquired) !== 1)
        throw new AppError(
          409,
          "Ứng dụng đang được nâng cấp ở một phiên khác. Vui lòng mở lại sau.",
        );
      locks.push(name);
    }
    if (!(await current(connection))) {
      await executeSql(
        connection,
        await readFile(
          new URL("../../database/02_app.sql", import.meta.url),
          "utf8",
        ),
      );
    }
  } finally {
    for (const name of locks.reverse())
      await connection.query("SELECT RELEASE_LOCK(?)", [name]).catch(() => {});
    connection.release();
  }
}
