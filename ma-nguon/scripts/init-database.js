import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { config } from "../server/config/index.js";
import { executeSql } from "../server/services/sql-runner.js";
const connection = await mysql.createConnection(config.mysql);
try {
  console.log(
    `Đang khởi tạo/nâng cấp ${config.database}. Dữ liệu hiện có được giữ lại.`,
  );
  const core = (
    await readFile(
      new URL("../database/01_project5.sql", import.meta.url),
      "utf8",
    )
  ).replaceAll("Project5_VanTai", config.database);
  await executeSql(connection, core);
  await executeSql(
    connection,
    await readFile(new URL("../database/02_app.sql", import.meta.url), "utf8"),
  );
  console.log(
    "Hoàn tất. Chạy npm run dev hoặc npm start, rồi tạo tài khoản quản trị trên giao diện.",
  );
} catch (error) {
  console.error(`Không khởi tạo được: ${error.code || ""} ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
