import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import request from "supertest";
import { readFile } from "node:fs/promises";
import { config } from "../config/index.js";
import { pool } from "../config/database.js";
import { createApp } from "../app.js";
import { executeSql } from "../services/sql-runner.js";
import { ensureAppSchema } from "../services/app-schema-service.js";
import { digest, csrfFor } from "../middleware/auth.js";
import { checksum } from "../services/file-service.js";

if (!/^VanHanhTest[A-Za-z0-9_]*$/.test(config.database))
  throw new Error("Chỉ dùng CSDL thử VanHanhTest.");
const application = createApp(),
  admin = request.agent(application),
  operator = request.agent(application),
  passenger = request.agent(application),
  other = request.agent(application),
  password = "Passenger-Test-Only!";
let adminCsrf,
  operatorCsrf,
  passengerCsrf,
  otherCsrf,
  bookingId,
  tomorrow,
  today;
const post = (agent, path, csrf, body) =>
  agent.post(path).set("X-CSRF-Token", csrf).send(body);
const book = (agent, csrf, trip, quantity = 1, extra = {}) =>
  post(agent, "/api/passenger/bookings", csrf, {
    MaSoChuyenXe: trip,
    SoLuong: quantity,
    GiaVe: 100000,
    ...extra,
  });
const cancel = (agent, csrf, id) =>
  post(agent, `/api/passenger/bookings/${id}/cancel`, csrf, {});
const trip = (id, quantity = 0, day = tomorrow) => ({
  MaSoChuyenXe: id,
  BienSo: "29B-123.45",
  MaTuyen: "T01",
  CMTLaiXe: "001085000001",
  CMTPhuXe: "001087000002",
  NgayThucHien: day,
  SoKhach: quantity,
  GiaVe: 100000,
});
async function createTrip(id, quantity = 0, day = tomorrow) {
  await post(
    admin,
    "/api/entities/trips",
    adminCsrf,
    trip(id, quantity, day),
  ).expect(201);
}
async function total(id) {
  const [rows] = await pool.execute(
    "SELECT SoKhach FROM CHUYEN_XE WHERE MaSoChuyenXe=?",
    [id],
  );
  return Number(rows[0].SoKhach);
}

before(async () => {
  const connection = await mysql.createConnection(config.mysql);
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${config.database}\``);
    await executeSql(
      connection,
      (
        await readFile(
          new URL("../../database/01_project5.sql", import.meta.url),
          "utf8",
        )
      ).replaceAll("Project5_VanTai", config.database),
    );
    await executeSql(
      connection,
      await readFile(new URL("./fixtures/app-v1.sql", import.meta.url), "utf8"),
    );
    const hash = await bcrypt.hash(password, 12);
    for (const [username, role] of [
      ["admin", "admin"],
      ["operator", "operator"],
      ["legacy_passenger", "viewer"],
    ]) {
      const [insert] = await connection.execute(
        "INSERT INTO APP_TAI_KHOAN(TenDangNhap,HoTen,MatKhauHash,VaiTro) VALUES(?,?,?,?)",
        [username, username, hash, role],
      );
      const token = `legacy-session-${username}`;
      await connection.execute(
        "INSERT INTO APP_PHIEN_DANG_NHAP VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [digest(token), insert.insertId, digest(csrfFor(token))],
      );
    }
  } finally {
    await connection.end();
  }
});
after(() => pool.end());

test("Vai trò Hành khách và đăng ký chuyến", async (t) => {
  await t.test(
    "Nâng cấp dữ liệu cũ, giữ mật khẩu và chỉ thu hồi phiên Người xem",
    async () => {
      await Promise.all([ensureAppSchema(), ensureAppSchema()]);
      const [columns] = await pool.query(
        "SHOW COLUMNS FROM APP_TAI_KHOAN LIKE 'VaiTro'",
      );
      assert.equal(columns[0].Type, "enum('admin','operator','passenger')");
      assert.equal(columns[0].Default, "passenger");
      const [rows] = await pool.query(
        "SELECT * FROM APP_TAI_KHOAN WHERE TenDangNhap='legacy_passenger'",
      );
      assert.equal(rows[0].VaiTro, "passenger");
      assert.ok(await bcrypt.compare(password, rows[0].MatKhauHash));
      await request(application)
        .get("/api/auth/me")
        .set("Cookie", "vanhanh_session=legacy-session-legacy_passenger")
        .expect(401);
      await request(application)
        .get("/api/auth/me")
        .set("Cookie", "vanhanh_session=legacy-session-admin")
        .expect(200);
      for (const [agent, username] of [
        [admin, "admin"],
        [operator, "operator"],
        [passenger, "legacy_passenger"],
      ]) {
        const result = await agent
          .post("/api/auth/login")
          .send({ username, password })
          .expect(200);
        if (username === "admin") adminCsrf = result.body.csrfToken;
        else if (username === "operator") operatorCsrf = result.body.csrfToken;
        else passengerCsrf = result.body.csrfToken;
      }
      const registration = await other
        .post("/api/auth/register")
        .send({
          TenDangNhap: "new_passenger",
          HoTen: "Hành khách mới",
          MatKhau: password,
          XacNhanMatKhau: password,
        })
        .expect(201);
      assert.equal(registration.body.user.VaiTro, "passenger");
      otherCsrf = (
        await other
          .post("/api/auth/login")
          .send({ username: "new_passenger", password })
          .expect(200)
      ).body.csrfToken;
      const [dates] = await pool.query(
        "SELECT CURDATE() AS today, DATE_ADD(CURDATE(),INTERVAL 1 DAY) AS tomorrow",
      );
      ({ today, tomorrow } = dates[0]);
      for (const [id, count] of [
        ["PA_BOOK", 2],
        ["PA_RACE", 42],
        ["PA_PRICE", 0],
        ["PA_DELETE", 0],
        ["PA_FAIL", 0],
      ])
        await createTrip(id, count);
      await createTrip("PA_TODAY", 0, today);
    },
  );

  await t.test(
    "Hành khách bị chặn toàn bộ API nội bộ, cả xuất tệp và tài khoản",
    async () => {
      await request(application).get("/api/passenger/trips").expect(401);
      for (const path of [
        "/api/options",
        "/api/dashboard",
        "/api/entities/drivers",
        "/api/entities/trips",
        "/api/reports/salary",
        "/api/reports/revenue/export",
        "/api/schedule",
        "/api/maps/T01",
        "/api/accounts",
        "/api/audit",
        "/api/bookings",
      ])
        await passenger.get(path).expect(403);
      await post(passenger, "/api/backups/export", passengerCsrf, {
        password,
      }).expect(403);
      await post(admin, "/api/accounts", adminCsrf, {
        TenDangNhap: "bad_role",
        HoTen: "Không hợp lệ",
        MatKhau: password,
        VaiTro: "viewer",
      }).expect(422);
      await passenger.get("/api/passenger/meta").expect(200);
    },
  );

  await t.test(
    "Danh sách chuyến chỉ có ngày tương lai và các trường dành cho hành khách",
    async () => {
      const result = await passenger
        .get("/api/passenger/trips?limit=100")
        .expect(200);
      assert.ok(result.body.rows.every((row) => row.NgayThucHien > today));
      for (const row of result.body.rows)
        for (const field of [
          "CMTLaiXe",
          "CMTPhuXe",
          "TenLaiXe",
          "LuongThangHienTai",
          "SoKhach",
          "DoanhThuChuyen",
        ])
          assert.ok(!Object.hasOwn(row, field));
      assert.equal(
        (await passenger.get("/api/passenger/trips?q=PA_BOOK").expect(200)).body
          .total,
        1,
      );
      await passenger
        .get("/api/passenger/trips?start=2028-01-01&end=2020-01-01")
        .expect(422);
      await passenger.get("/api/passenger/trips?page=0").expect(422);
    },
  );

  await t.test(
    "Đăng ký cộng đúng số khách, giữ khách nhập tay và không lộ đăng ký của người khác",
    async () => {
      const result = await book(passenger, passengerCsrf, "PA_BOOK", 3).expect(
        201,
      );
      bookingId = result.body.Id;
      assert.equal(result.body.ThanhTien, "300000");
      assert.equal(await total("PA_BOOK"), 5);
      const mine = await passenger
        .get("/api/passenger/bookings?q=PA_BOOK")
        .expect(200);
      assert.equal(mine.body.total, 1);
      assert.equal(mine.body.rows[0].SoLuong, 3);
      assert.equal(mine.body.rows[0].CoTheHuy, true);
      assert.equal(
        (await other.get("/api/passenger/bookings").expect(200)).body.total,
        0,
      );
      await cancel(other, otherCsrf, bookingId).expect(404);
      assert.equal(
        (await other.get("/api/passenger/bookings?TaiKhoanId=3").expect(200))
          .body.total,
        0,
      );
      const list = await operator
        .get("/api/bookings?q=legacy_passenger")
        .expect(200);
      assert.equal(list.body.total, 1);
      assert.equal(list.body.rows[0].HoTen, "legacy_passenger");
    },
  );

  await t.test(
    "Chặn đăng ký trùng, giả chủ sở hữu, thiếu CSRF, quá chỗ và báo giá cũ",
    async () => {
      await book(passenger, passengerCsrf, "PA_BOOK", 1).expect(409);
      for (const extra of [
        { SoLuong: 0 },
        { SoLuong: -1 },
        { SoLuong: 1.5 },
        { TaiKhoanId: 1 },
        { VaiTro: "admin" },
      ])
        await book(passenger, passengerCsrf, "PA_PRICE", 1, extra).expect(422);
      await book(passenger, passengerCsrf, "PA_PRICE", 44).expect(409);
      await book(passenger, passengerCsrf, "PA_PRICE", 1, { GiaVe: 1 }).expect(
        409,
      );
      await book(passenger, passengerCsrf, "PA_TODAY", 1).expect(409);
      await book(passenger, "", "PA_PRICE", 1).expect(403);
      await post(passenger, "/api/passenger/bookings", passengerCsrf, {
        MaSoChuyenXe: "PA_PRICE",
        SoLuong: 1,
        GiaVe: 100000,
      })
        .set("Origin", "https://untrusted.invalid")
        .expect(403);
      assert.equal(await total("PA_PRICE"), 0);
      assert.equal(await total("PA_BOOK"), 5);
    },
  );

  await t.test(
    "Hủy trả đúng chỗ, hủy lặp không trừ hai lần và đăng ký lại được",
    async () => {
      await cancel(passenger, passengerCsrf, bookingId).expect(200);
      assert.equal(await total("PA_BOOK"), 2);
      const again = await cancel(passenger, passengerCsrf, bookingId).expect(
        200,
      );
      assert.equal(again.body.alreadyCancelled, true);
      assert.equal(await total("PA_BOOK"), 2);
      const rebook = await book(passenger, passengerCsrf, "PA_BOOK", 2).expect(
        201,
      );
      assert.equal(rebook.body.Id, bookingId);
      assert.equal(await total("PA_BOOK"), 4);
    },
  );

  await t.test(
    "Hai người tranh chỗ cuối không vượt sức chứa, hai hủy đồng thời chỉ trả chỗ một lần",
    async () => {
      const results = await Promise.all([
        book(passenger, passengerCsrf, "PA_RACE"),
        book(other, otherCsrf, "PA_RACE"),
      ]);
      assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
      assert.equal(await total("PA_RACE"), 43);
      const index = results.findIndex((row) => row.status === 201),
        agent = index === 0 ? passenger : other,
        csrf = index === 0 ? passengerCsrf : otherCsrf,
        id = results[index].body.Id;
      const cancellations = await Promise.all([
        cancel(agent, csrf, id),
        cancel(agent, csrf, id),
      ]);
      assert.ok(cancellations.every((row) => row.status === 200));
      assert.equal(await total("PA_RACE"), 42);
      const booking = await book(other, otherCsrf, "PA_RACE").expect(201);
      await post(
        operator,
        `/api/bookings/${booking.body.Id}/cancel`,
        operatorCsrf,
        { LyDoHuy: "Nhà xe hỗ trợ hủy" },
      ).expect(200);
      assert.equal(await total("PA_RACE"), 42);
    },
  );

  await t.test(
    "Ràng buộc MySQL ngăn giảm khách dưới đăng ký hoặc thay hành trình đã giữ chỗ",
    async () => {
      const update = (values) =>
        admin
          .put("/api/entities/trips/PA_BOOK")
          .set("X-CSRF-Token", adminCsrf)
          .send({ ...trip("PA_BOOK", 4), ...values });
      for (const values of [
        { SoKhach: 1 },
        { GiaVe: 120000 },
        { MaTuyen: "T02" },
        { BienSo: "29B-234.56" },
        { NgayThucHien: today },
      ])
        await update(values).expect(422);
      await admin
        .put("/api/entities/routes/T01")
        .set("X-CSRF-Token", adminCsrf)
        .send({
          MaTuyen: "T01",
          DiemDau: "Hà Nội",
          DiemCuoi: "Huế",
          DoDai: 120,
          DoPhucTap: 1,
        })
        .expect(422);
      await update({ SoKhach: 6 }).expect(200);
      await cancel(passenger, passengerCsrf, bookingId).expect(200);
      assert.equal(await total("PA_BOOK"), 4);
      await book(passenger, passengerCsrf, "PA_BOOK", 1).expect(201);
      assert.equal(await total("PA_BOOK"), 5);
    },
  );

  await t.test(
    "Nhà xe hủy chuyến thì đăng ký bị hủy, vẫn giữ xác nhận và lý do cho hành khách",
    async () => {
      await book(passenger, passengerCsrf, "PA_DELETE", 2).expect(201);
      await operator
        .delete("/api/entities/trips/PA_DELETE")
        .set("X-CSRF-Token", operatorCsrf)
        .expect(200);
      const result = await passenger
        .get("/api/passenger/bookings?q=PA_DELETE")
        .expect(200);
      assert.equal(result.body.total, 1);
      assert.equal(result.body.rows[0].TrangThai, "cancelled");
      assert.equal(result.body.rows[0].LyDoHuy, "Nhà xe hủy chuyến");
      assert.equal(result.body.rows[0].MaSoChuyenXe, "PA_DELETE");
      await book(passenger, passengerCsrf, "PA_DELETE").expect(404);
    },
  );

  await t.test(
    "Nếu ghi nhật ký lỗi, hoàn tác cả đăng ký lẫn số khách",
    async () => {
      await pool.query(
        "CREATE TRIGGER test_reject_booking BEFORE INSERT ON APP_NHAT_KY FOR EACH ROW BEGIN IF NEW.HanhDong='BOOK' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test audit failure'; END IF; END",
      );
      try {
        await book(passenger, passengerCsrf, "PA_FAIL").expect(422);
      } finally {
        await pool.query("DROP TRIGGER test_reject_booking");
      }
      assert.equal(await total("PA_FAIL"), 0);
      assert.equal(
        (await passenger.get("/api/passenger/bookings?q=PA_FAIL").expect(200))
          .body.total,
        0,
      );
    },
  );

  await t.test(
    "Phục hồi bảo toàn đăng ký tương thích và từ chối bản sao làm mất chỗ đã giữ",
    async () => {
      const saved = (
        await post(admin, "/api/backups/export", adminCsrf, {
          password,
        }).expect(200)
      ).body;
      const restore = (payload) =>
        admin
          .post("/api/backups/restore")
          .set("X-CSRF-Token", adminCsrf)
          .field("password", password)
          .field("confirmation", "PHUC HOI")
          .attach("file", Buffer.from(JSON.stringify(payload)), "backup.json");
      await createTrip("PA_EXTRA");
      const extra = await book(other, otherCsrf, "PA_EXTRA").expect(201);
      await restore(saved).expect(409);
      assert.equal(await total("PA_EXTRA"), 1);
      await cancel(other, otherCsrf, extra.body.Id).expect(200);
      await operator
        .delete("/api/entities/trips/PA_EXTRA")
        .set("X-CSRF-Token", operatorCsrf)
        .expect(200);
      const { checksum: oldChecksum, ...bad } = structuredClone(saved);
      bad.tables.trips.find((row) => row.MaSoChuyenXe === "PA_BOOK").SoKhach =
        0;
      await restore({ ...bad, checksum: checksum(bad) }).expect(409);
      assert.equal(await total("PA_BOOK"), 5);
      await restore(saved).expect(200);
      assert.equal(await total("PA_BOOK"), 5);
      const mine = await passenger
        .get("/api/passenger/bookings?q=PA_BOOK")
        .expect(200);
      assert.equal(mine.body.rows[0].Id, bookingId);
      assert.equal(mine.body.rows[0].CoTheHuy, true);
    },
  );

  await t.test(
    "Nâng cấp lặp lại giữ tài khoản, đăng ký và truy vấn đếm đúng bốn bảng nghiệp vụ",
    async () => {
      const [before] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_DANG_KY_CHUYEN",
      );
      await ensureAppSchema();
      await ensureAppSchema();
      const connection = await pool.getConnection();
      try {
        await executeSql(
          connection,
          await readFile(
            new URL("../../database/02_app.sql", import.meta.url),
            "utf8",
          ),
        );
      } finally {
        connection.release();
      }
      const [after] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_DANG_KY_CHUYEN",
      );
      assert.equal(after[0].total, before[0].total);
      const counts = await admin.get("/api/reports/records").expect(200);
      assert.equal(counts.body.rows.length, 5);
      assert.ok(!JSON.stringify(counts.body.rows).includes("APP_DANG_KY"));
      const audit = await admin.get("/api/audit?limit=100").expect(200);
      assert.ok(audit.body.rows.some((row) => row.HanhDong === "BOOK"));
      assert.ok(!JSON.stringify(audit.body).includes(password));
    },
  );
});
