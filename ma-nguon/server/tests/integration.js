import test, { before, after } from "node:test";
import { fork } from "node:child_process";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import request from "supertest";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { config } from "../config/index.js";
import { pool } from "../config/database.js";
import { executeSql } from "../services/sql-runner.js";
import { createApp } from "../app.js";
if (!/^VanHanhTest[A-Za-z0-9_]*$/.test(config.database))
  throw new Error(
    "Chỉ chạy kiểm thử tích hợp với DB_NAME bắt đầu bằng VanHanhTest.",
  );
const application = createApp(),
  admin = request.agent(application),
  passenger = request.agent(application),
  operator = request.agent(application);
let adminCsrf, passengerCsrf, operatorCsrf, clock, backup;
const password = "Project5-Test-Only!";
const write = (agent, method, path, csrf, body) =>
  agent[method](path).set("X-CSRF-Token", csrf).send(body);
before(async () => {
  const connection = await mysql.createConnection(config.mysql);
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
  await connection.end();
});
after(() => pool.end());
test("Ứng dụng MySQL hoàn chỉnh", async (t) => {
  await t.test("API được bảo vệ trước đăng nhập", async () => {
    await request(application).get("/api/dashboard").expect(401);
    await request(application).get("/api/health").expect(200);
  });
  await t.test("Thiết lập quản trị, mã CSRF và phiên đăng nhập", async () => {
    await request(application)
      .post("/api/auth/setup")
      .send({ setupToken: "wrong", account: {} })
      .expect(403);
    const result = await admin
      .post("/api/auth/setup")
      .send({
        setupToken: config.setupToken,
        account: {
          TenDangNhap: "admin",
          HoTen: "Quản trị thử nghiệm",
          MatKhau: password,
        },
      })
      .expect(201);
    adminCsrf = result.body.csrfToken;
    assert.equal(result.body.user.VaiTro, "admin");
    const me = await admin.get("/api/auth/me").expect(200);
    assert.equal(me.body.csrfToken, adminCsrf);
    await admin
      .post("/api/auth/setup")
      .set("X-CSRF-Token", adminCsrf)
      .send({
        setupToken: config.setupToken,
        account: { TenDangNhap: "other", HoTen: "Khác", MatKhau: password },
      })
      .expect(409);
  });
  await t.test("Kiểm tra CSRF và nguồn yêu cầu", async () => {
    await admin.post("/api/entities/routes").send({}).expect(403);
    await admin
      .post("/api/entities/routes")
      .set("Origin", "https://untrusted.invalid")
      .set("X-CSRF-Token", adminCsrf)
      .send({})
      .expect(403);
  });
  await t.test("Đọc bảng thật, đủ cột lương và bảo dưỡng", async () => {
    const buses = await admin.get("/api/entities/buses?limit=100").expect(200);
    assert.equal(buses.body.total, 6);
    assert.ok(buses.body.rows.every((row) => row.NgayBaoDuongTiepTheo));
    const drivers = await admin.get("/api/entities/drivers").expect(200);
    assert.equal(drivers.body.total, 6);
    assert.ok(
      drivers.body.rows.every((row) => Object.hasOwn(row, "LuongThangHienTai")),
    );
    const options = await admin.get("/api/options").expect(200);
    clock = options.body.clock;
  });
  await t.test(
    "Báo cáo theo đề có ngày bắt đầu / kết thúc và xe doanh thu 0",
    async () => {
      const revenue = await admin.get("/api/reports/revenue").expect(200);
      assert.equal(revenue.body.rows.length, 6);
      assert.equal(revenue.body.rows[0].NgayBatDau, clock.monthStart);
      assert.equal(revenue.body.rows[0].NgayKetThuc, clock.today);
      assert.ok(revenue.body.rows.some((row) => Number(row.DoanhThu) === 0));
      for (const type of [
        "salary",
        "maintenance",
        "records",
        "passengers",
        "occupancy",
        "inactive",
      ])
        await admin.get("/api/reports/" + type).expect(200);
      await admin
        .get("/api/reports/revenue?start=2026-12-01&end=2026-01-01")
        .expect(422);
      const counts = await admin.get("/api/reports/records");
      assert.equal(Number(counts.body.rows.at(-1).SoBanGhi), 38);
    },
  );
  await t.test("Tìm kiếm, lọc và phân trang", async () => {
    const second = await admin
      .get("/api/entities/trips?page=2&limit=3")
      .expect(200);
    assert.equal(second.body.rows.length, 3);
    const found = await admin.get("/api/entities/drivers?q=Nguyễn").expect(200);
    assert.equal(found.body.rows.length, 1);
    const byDriver = await admin
      .get("/api/entities/trips?q=" + encodeURIComponent("Phạm Văn Dũng"))
      .expect(200);
    assert.ok(byDriver.body.rows.length > 0);
    await admin
      .get("/api/entities/trips?start=2026-12-01&end=2026-01-01")
      .expect(422);
    await admin.get("/api/entities/buses?page=0").expect(422);
    await admin.get("/api/entities/injection").expect(404);
  });
  await t.test("CRUD tuyến và bảo vệ khóa ngoại", async () => {
    const route = {
      MaTuyen: "TEST",
      DiemDau: "Hà Nội",
      DiemCuoi: "Huế",
      DoDai: 600,
      DoPhucTap: 3,
    };
    await write(admin, "post", "/api/entities/routes", adminCsrf, route).expect(
      201,
    );
    await write(admin, "post", "/api/entities/routes", adminCsrf, route).expect(
      409,
    );
    await write(admin, "put", "/api/entities/routes/TEST", adminCsrf, {
      ...route,
      DoDai: 650,
    }).expect(200);
    await write(admin, "delete", "/api/entities/routes/TEST", adminCsrf).expect(
      200,
    );
    await write(admin, "delete", "/api/entities/routes/T01", adminCsrf).expect(
      409,
    );
    await write(admin, "put", "/api/entities/routes/T01", adminCsrf, {
      MaTuyen: "T01",
      DiemDau: "Hà Nội",
      DiemCuoi: "Hải Phòng",
      DoDai: 120,
      DoPhucTap: 4,
    }).expect(422);
  });
  await t.test("Ràng buộc chuyến và cập nhật lương theo vai trò", async () => {
    const trip = {
      MaSoChuyenXe: "APITEST",
      BienSo: "29B-123.45",
      MaTuyen: "T06",
      CMTLaiXe: "001085000001",
      CMTPhuXe: "001087000002",
      NgayThucHien: clock.today,
      SoKhach: 20,
      GiaVe: 200000,
    };
    await write(admin, "post", "/api/entities/trips", adminCsrf, {
      ...trip,
      CMTPhuXe: trip.CMTLaiXe,
    }).expect(422);
    await write(admin, "post", "/api/entities/trips", adminCsrf, {
      ...trip,
      SoKhach: 44,
    }).expect(422);
    const before = await admin.get("/api/entities/drivers/001085000001");
    await write(admin, "post", "/api/entities/trips", adminCsrf, trip).expect(
      201,
    );
    const after = await admin.get("/api/entities/drivers/001085000001");
    assert.equal(
      Number(after.body.record.LuongThangHienTai) -
        Number(before.body.record.LuongThangHienTai),
      300000,
    );
    await write(admin, "put", "/api/entities/trips/APITEST", adminCsrf, {
      ...trip,
      CMTLaiXe: "001087000002",
      CMTPhuXe: "001085000001",
    }).expect(200);
    const swapped = await admin.get("/api/entities/drivers/001085000001");
    assert.equal(
      Number(swapped.body.record.LuongThangHienTai) -
        Number(before.body.record.LuongThangHienTai),
      150000,
    );
    await write(
      admin,
      "delete",
      "/api/entities/trips/APITEST",
      adminCsrf,
    ).expect(200);
  });
  await t.test("Lịch sử xe / tài xế và lịch trình", async () => {
    const bus = await admin.get("/api/entities/buses/29B-123.45").expect(200);
    assert.equal(bus.body.history.length, 5);
    const driver = await admin
      .get("/api/entities/drivers/001084000004")
      .expect(200);
    assert.ok(driver.body.history.length >= 4);
    await admin
      .get("/api/schedule?start=" + clock.monthStart + "&end=" + clock.today)
      .expect(200);
  });
  await t.test(
    "Ghi nhận bảo dưỡng và không chấp nhận ngày tương lai",
    async () => {
      const [rows] = await pool.query(
        "SELECT DATE_ADD(CURDATE(),INTERVAL 1 DAY) AS tomorrow",
      );
      await write(admin, "post", "/api/maintenance/29B-567.89", adminCsrf, {
        date: rows[0].tomorrow,
      }).expect(422);
      const result = await write(
        admin,
        "post",
        "/api/maintenance/29B-567.89",
        adminCsrf,
        { date: clock.today },
      ).expect(200);
      assert.equal(result.body.NgayBaoDuongCuoiCung, clock.today);
    },
  );
  await t.test("Nhập CSV tiếng Việt và hoàn tác nếu một dòng lỗi", async () => {
    const csv =
      "\uFEFFMã tuyến,Điểm đầu,Điểm cuối,Độ dài (km),Độ phức tạp\nIMPORT1,Hà Nội,Huế,600,2\n";
    const imported = await admin
      .post("/api/entities/routes/import")
      .set("X-CSRF-Token", adminCsrf)
      .attach("file", Buffer.from(csv), "routes.csv")
      .expect(200);
    assert.equal(imported.body.imported, 1);
    const bad =
      "MaTuyen,DiemDau,DiemCuoi,DoDai,DoPhucTap\nIMPORT2,A,B,10,1\nT01,A,B,10,1\n";
    await admin
      .post("/api/entities/routes/import")
      .set("X-CSRF-Token", adminCsrf)
      .attach("file", Buffer.from(bad), "routes.csv")
      .expect(409);
    await admin.get("/api/entities/routes/IMPORT2").expect(404);
    await admin
      .post("/api/entities/routes/import")
      .set("X-CSRF-Token", adminCsrf)
      .attach("file", Buffer.from("khong-phai-tep-excel"), "invalid.xlsx")
      .expect(422);
  });
  await t.test("Nhập Excel và xuất Excel / CSV thật", async () => {
    const workbook = new ExcelJS.Workbook(),
      sheet = workbook.addWorksheet("Tuyến");
    sheet.addRow(["MaTuyen", "DiemDau", "DiemCuoi", "DoDai", "DoPhucTap"]);
    sheet.addRow(["IMPORT3", "Hà Nội", "Huế", 600, 2]);
    await admin
      .post("/api/entities/routes/import")
      .set("X-CSRF-Token", adminCsrf)
      .attach(
        "file",
        Buffer.from(await workbook.xlsx.writeBuffer()),
        "routes.xlsx",
      )
      .expect(200);
    const result = await admin.get("/api/entities/routes/export").expect(200);
    assert.match(result.headers["content-type"], /spreadsheetml/);
    const csv = await admin
      .get("/api/reports/revenue/export?format=csv")
      .expect(200);
    assert.match(csv.text, /NgayBatDau/);
  });
  await t.test(
    "Tạo tài khoản hành khách và nhân viên; phân quyền máy chủ",
    async () => {
      for (const role of ["passenger", "operator"])
        await write(admin, "post", "/api/accounts", adminCsrf, {
          TenDangNhap: role,
          HoTen: role,
          MatKhau: password,
          VaiTro: role,
          HoatDong: true,
        }).expect(201);
      const v = await passenger
        .post("/api/auth/login")
        .send({ username: "passenger", password })
        .expect(200);
      passengerCsrf = v.body.csrfToken;
      const o = await operator
        .post("/api/auth/login")
        .send({ username: "operator", password })
        .expect(200);
      operatorCsrf = o.body.csrfToken;
      await passenger.get("/api/reports/salary").expect(403);
      await passenger.get("/api/passenger/trips").expect(200);
      await write(
        passenger,
        "post",
        "/api/entities/routes",
        passengerCsrf,
        {},
      ).expect(403);
      await passenger.get("/api/accounts").expect(403);
      await operator.get("/api/audit").expect(403);
      await write(
        operator,
        "delete",
        "/api/entities/routes/IMPORT1",
        operatorCsrf,
      ).expect(403);
    },
  );
  await t.test("Nhân viên không sửa chuyến đã thực hiện", async () => {
    const result = await admin.get("/api/entities/trips/CX001");
    const row = Object.fromEntries(
      [
        "MaSoChuyenXe",
        "BienSo",
        "MaTuyen",
        "CMTLaiXe",
        "CMTPhuXe",
        "NgayThucHien",
        "SoKhach",
        "GiaVe",
      ].map((key) => [key, result.body.record[key]]),
    );
    await write(
      operator,
      "put",
      "/api/entities/trips/CX001",
      operatorCsrf,
      row,
    ).expect(403);
  });
  await t.test("Nhật ký lưu thay đổi và không chứa mật khẩu", async () => {
    const result = await admin.get("/api/audit?limit=100").expect(200);
    assert.ok(result.body.total > 10);
    assert.ok(result.body.rows.some((row) => row.HanhDong === "CREATE"));
    assert.ok(!JSON.stringify(result.body).includes(password));
    assert.ok(!JSON.stringify(result.body).includes("MatKhauHash"));
  });
  await t.test("Sao lưu, kiểm tra và phục hồi nguyên tử", async () => {
    await write(admin, "post", "/api/backups/export", adminCsrf, {
      password: "wrong",
    }).expect(403);
    const exported = await write(
      admin,
      "post",
      "/api/backups/export",
      adminCsrf,
      { password },
    ).expect(200);
    backup = Buffer.from(JSON.stringify(exported.body));
    const preview = await admin
      .post("/api/backups/preview")
      .set("X-CSRF-Token", adminCsrf)
      .attach("file", backup, "backup.json")
      .expect(200);
    assert.equal(preview.body.counts.trips, 20);
    await admin
      .post("/api/backups/restore")
      .set("X-CSRF-Token", adminCsrf)
      .field("password", password)
      .field("confirmation", "wrong")
      .attach("file", backup, "backup.json")
      .expect(422);
    await write(
      admin,
      "delete",
      "/api/entities/routes/IMPORT1",
      adminCsrf,
    ).expect(200);
    await admin
      .post("/api/backups/restore")
      .set("X-CSRF-Token", adminCsrf)
      .field("password", password)
      .field("confirmation", "PHUC HOI")
      .attach("file", backup, "backup.json")
      .expect(200);
    await admin.get("/api/entities/routes/IMPORT1").expect(200);
    const users = await admin.get("/api/accounts").expect(200);
    assert.equal(users.body.total, 3);
  });
  await t.test(
    "Khóa tài khoản thu hồi phiên; không tự hạ quyền quản trị",
    async () => {
      const users = await admin.get("/api/accounts");
      const v = users.body.rows.find((row) => row.VaiTro === "passenger");
      await write(admin, "put", "/api/accounts/" + v.Id, adminCsrf, {
        TenDangNhap: v.TenDangNhap,
        HoTen: v.HoTen,
        VaiTro: v.VaiTro,
        HoatDong: false,
      }).expect(200);
      await passenger.get("/api/dashboard").expect(401);
      const a = users.body.rows.find((row) => row.VaiTro === "admin");
      await write(admin, "put", "/api/accounts/" + a.Id, adminCsrf, {
        TenDangNhap: a.TenDangNhap,
        HoTen: a.HoTen,
        VaiTro: "passenger",
        HoatDong: true,
      }).expect(422);
    },
  );
  await t.test("Khởi tạo lại giữ nguyên dữ liệu và tài khoản", async () => {
    const before = await admin.get("/api/entities/drivers").expect(200);
    const connection = await pool.getConnection();
    try {
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
      connection.release();
    }
    const after = await admin.get("/api/entities/drivers").expect(200);
    assert.deepEqual(after.body.rows, before.body.rows);
    const users = await admin.get("/api/accounts").expect(200);
    assert.equal(users.body.total, 3);
  });
  await t.test(
    "Service desktop tự mở cổng nội bộ và dừng theo ứng dụng",
    async () => {
      const worker = fork(
        new URL("./desktop-worker-bridge.cjs", import.meta.url),
        {
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          env: { ...process.env },
        },
      );
      try {
        const ready = await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Desktop service startup timeout")),
            10000,
          );
          worker.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error("Desktop service exited: " + code));
          });
          worker.on("message", (value) => {
            if (value.type === "ready") {
              clearTimeout(timer);
              resolve(value);
            }
            if (value.type === "error") {
              clearTimeout(timer);
              reject(new Error(value.message));
            }
          });
        });
        assert.ok(ready.port > 0);
        assert.equal(ready.initialized, true);
        const health = await fetch(`http://127.0.0.1:${ready.port}/api/health`);
        assert.equal(health.status, 200);
        const denied = await fetch(
          `http://127.0.0.1:${ready.port}/api/dashboard`,
        );
        assert.equal(denied.status, 401);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Desktop service shutdown timeout")),
            5000,
          );
          worker.once("exit", (code) => {
            clearTimeout(timer);
            code === 0 ? resolve() : reject(new Error("Exit code " + code));
          });
          worker.send({ type: "shutdown" });
        });
      } finally {
        if (worker.exitCode === null) worker.kill();
      }
    },
  );
  await t.test("Đăng xuất chấm dứt phiên", async () => {
    await write(operator, "post", "/api/auth/logout", operatorCsrf).expect(200);
    await operator.get("/api/dashboard").expect(401);
  });
});
