import "dotenv/config";
import { randomBytes } from "node:crypto";
const database = process.env.DB_NAME || "Project5_VanTai";
if (!/^[A-Za-z0-9_]{1,64}$/.test(database))
  throw new Error("DB_NAME chỉ được chứa chữ, số và dấu gạch dưới.");
export const config = {
  database,
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
  origins: (
    process.env.APP_ORIGIN || "http://localhost:5173,http://localhost:3001"
  )
    .split(",")
    .map((s) => s.trim()),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  setupToken: process.env.SETUP_TOKEN || randomBytes(18).toString("hex"),
  mysql: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    timezone: "+07:00",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
};
