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

if (!/^VanHanhTest[A-Za-z0-9_]*$/.test(config.database))
  throw new Error("Chỉ kiểm thử với DB_NAME bắt đầu bằng VanHanhTest.");

const password = "Registration-Test-Only!",
  account = {
    TenDangNhap: "new_user",
    HoTen: "Người dùng tự đăng ký",
    MatKhau: password,
    XacNhanMatKhau: password,
  },
  admin = request.agent(createApp()),
  member = request.agent(createApp());
let adminCsrf, memberCsrf, memberId;

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
      await readFile(
        new URL("../../database/02_app.sql", import.meta.url),
        "utf8",
      ),
    );
  } finally {
    await connection.end();
  }
});
after(() => pool.end());

test("Tự đăng ký tài khoản với MySQL", async (t) => {
  await t.test(
    "Đăng ký không chiếm quyền thiết lập quản trị viên đầu tiên",
    async () => {
      await request(createApp())
        .post("/api/auth/register")
        .send(account)
        .expect(409);
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
      );
      assert.equal(Number(rows[0].total), 0);
      const setup = await admin
        .post("/api/auth/setup")
        .send({
          setupToken: config.setupToken,
          account: {
            TenDangNhap: "signup_admin",
            HoTen: "Quản trị",
            MatKhau: password,
          },
        })
        .expect(201);
      adminCsrf = setup.body.csrfToken;
      assert.equal(setup.body.user.VaiTro, "admin");
    },
  );

  await t.test(
    "Kiểm tra tên, mật khẩu xác nhận và không nhận quyền từ người đăng ký",
    async () => {
      const app = createApp();
      for (const changes of [
        { TenDangNhap: "a' OR 1=1" },
        { HoTen: "  " },
        { MatKhau: "short", XacNhanMatKhau: "short" },
        { XacNhanMatKhau: "Different-password" },
        { XacNhanMatKhau: undefined },
        { VaiTro: "admin" },
        { HoatDong: false },
        { MatKhau: "😀".repeat(20), XacNhanMatKhau: "😀".repeat(20) },
      ])
        await request(app)
          .post("/api/auth/register")
          .send({ ...account, ...changes })
          .expect(422);
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN",
      );
      assert.equal(Number(rows[0].total), 1);
    },
  );

  await t.test(
    "Đăng ký không cần đăng nhập; lưu hash, giữ tên có dấu và không tự tạo phiên",
    async () => {
      const registered = await member
        .post("/api/auth/register")
        .send({
          ...account,
          TenDangNhap: "  new_user  ",
          HoTen: "  Người dùng tự đăng ký  ",
        })
        .expect(201);
      assert.equal(registered.body.user.VaiTro, "passenger");
      assert.equal(registered.body.user.HoTen, account.HoTen);
      assert.equal(registered.body.user.TenDangNhap, account.TenDangNhap);
      assert.ok(!registered.headers["set-cookie"]);
      assert.ok(!JSON.stringify(registered.body).includes(password));
      assert.ok(!JSON.stringify(registered.body).includes("MatKhauHash"));
      memberId = registered.body.user.Id;
      const [rows] = await pool.execute(
        "SELECT * FROM APP_TAI_KHOAN WHERE Id=?",
        [memberId],
      );
      assert.equal(rows[0].VaiTro, "passenger");
      assert.equal(Number(rows[0].HoatDong), 1);
      assert.notEqual(rows[0].MatKhauHash, password);
      assert.ok(await bcrypt.compare(password, rows[0].MatKhauHash));
      await member.get("/api/auth/me").expect(401);
    },
  );

  await t.test(
    "Tài khoản vừa đăng ký đăng nhập được cổng hành khách và bị chặn báo cáo nội bộ",
    async () => {
      await member
        .post("/api/auth/login")
        .send({ username: account.TenDangNhap, password: "wrong" })
        .expect(401);
      const login = await member
        .post("/api/auth/login")
        .send({ username: account.TenDangNhap, password })
        .expect(200);
      memberCsrf = login.body.csrfToken;
      assert.equal(login.body.user.VaiTro, "passenger");
      await member.get("/api/reports/records").expect(403);
      await member.get("/api/passenger/meta").expect(200);
      await member.get("/api/accounts").expect(403);
      await member
        .post("/api/entities/routes")
        .set("X-CSRF-Token", memberCsrf)
        .send({})
        .expect(403);
      await member
        .put("/api/accounts/" + memberId)
        .set("X-CSRF-Token", memberCsrf)
        .send({ VaiTro: "admin" })
        .expect(403);
    },
  );

  await t.test(
    "Trùng tên kể cả khác chữ hoa chỉ trả lỗi, không thay mật khẩu hoặc quyền",
    async () => {
      const app = createApp();
      for (const name of ["new_user", "NEW_USER"])
        await request(app)
          .post("/api/auth/register")
          .send({ ...account, TenDangNhap: name })
          .expect(409);
      const me = await member.get("/api/auth/me").expect(200);
      assert.equal(me.body.user.VaiTro, "passenger");
    },
  );

  await t.test(
    "Hai đăng ký đồng thời cùng tên chỉ tạo một tài khoản và một nhật ký",
    async () => {
      const app = createApp(),
        race = { ...account, TenDangNhap: "race_user" };
      const results = await Promise.all([
        request(app).post("/api/auth/register").send(race),
        request(app).post("/api/auth/register").send(race),
      ]);
      assert.deepEqual(results.map((value) => value.status).sort(), [201, 409]);
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_TAI_KHOAN WHERE TenDangNhap='race_user'",
      );
      assert.equal(Number(rows[0].total), 1);
      const [logs] = await pool.query(
        "SELECT COUNT(*) AS total FROM APP_NHAT_KY l JOIN APP_TAI_KHOAN a ON a.Id=l.TaiKhoanId WHERE l.HanhDong='REGISTER' AND a.TenDangNhap='race_user'",
      );
      assert.equal(Number(logs[0].total), 1);
    },
  );

  await t.test(
    "Chặn nguồn lạ và giới hạn đăng ký không chặn đăng nhập hợp lệ",
    async () => {
      await request(createApp())
        .post("/api/auth/register")
        .set("Origin", "https://untrusted.invalid")
        .send({ ...account, TenDangNhap: "foreign_user" })
        .expect(403);
      const app = createApp();
      for (let i = 0; i < 10; i++)
        await request(app).post("/api/auth/register").send({}).expect(422);
      await request(app).post("/api/auth/register").send(account).expect(429);
      await request(app)
        .post("/api/auth/login")
        .send({ username: account.TenDangNhap, password })
        .expect(200);
    },
  );

  await t.test(
    "Quản trị viên nâng quyền tài khoản tự đăng ký và thu hồi phiên cũ",
    async () => {
      await admin
        .put("/api/accounts/" + memberId)
        .set("X-CSRF-Token", adminCsrf)
        .send({
          TenDangNhap: account.TenDangNhap,
          HoTen: account.HoTen,
          VaiTro: "operator",
          HoatDong: true,
        })
        .expect(200);
      await member.get("/api/auth/me").expect(401);
      const login = await member
        .post("/api/auth/login")
        .send({ username: account.TenDangNhap, password })
        .expect(200);
      memberCsrf = login.body.csrfToken;
      assert.equal(login.body.user.VaiTro, "operator");
      await member
        .post("/api/entities/routes")
        .set("X-CSRF-Token", memberCsrf)
        .send({
          MaTuyen: "SIGNUP",
          DiemDau: "Hà Nội",
          DiemCuoi: "Huế",
          DoDai: 600,
          DoPhucTap: 2,
        })
        .expect(201);
      await admin
        .delete("/api/entities/routes/SIGNUP")
        .set("X-CSRF-Token", adminCsrf)
        .expect(200);
    },
  );

  await t.test(
    "Khóa tài khoản tự đăng ký chấm dứt phiên và ngăn đăng nhập",
    async () => {
      await admin
        .put("/api/accounts/" + memberId)
        .set("X-CSRF-Token", adminCsrf)
        .send({
          TenDangNhap: account.TenDangNhap,
          HoTen: account.HoTen,
          VaiTro: "passenger",
          HoatDong: false,
        })
        .expect(200);
      await member.get("/api/auth/me").expect(401);
      await member
        .post("/api/auth/login")
        .send({ username: account.TenDangNhap, password })
        .expect(401);
    },
  );

  await t.test(
    "Nhật ký đăng ký không lộ mật khẩu và số dòng nghiệp vụ vẫn đúng",
    async () => {
      const logs = await admin.get("/api/audit?limit=100").expect(200);
      assert.equal(
        logs.body.rows.filter((row) => row.HanhDong === "REGISTER").length,
        2,
      );
      assert.ok(!JSON.stringify(logs.body).includes(password));
      assert.ok(!JSON.stringify(logs.body).includes("MatKhauHash"));
      const counts = await admin.get("/api/reports/records").expect(200);
      assert.equal(Number(counts.body.rows.at(-1).SoBanGhi), 38);
    },
  );
});
