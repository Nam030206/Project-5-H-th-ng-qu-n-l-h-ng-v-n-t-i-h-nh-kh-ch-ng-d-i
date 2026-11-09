import test from "node:test";
import { money, tripRevenue } from "../../client/src/lib/format.js";
import assert from "node:assert/strict";
import { isDate, validate, dateRange } from "../services/validation.js";
import { splitSql } from "../services/sql-runner.js";
import {
  checksum,
  parseBackup,
  inputFields,
} from "../services/file-service.js";
test("Tiền đồng giữ chính xác vượt giới hạn số nguyên JavaScript", () => {
  const exact = tripRevenue("32765", "999999999999");
  assert.equal(exact, 32764999999967235n);
  assert.equal(
    money(String(exact)),
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(exact),
  );
});
test("Ngày hợp lệ, năm nhuận và giới hạn ngày", () => {
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("2026-04-31"), false);
  assert.equal(isDate("07/11/2026"), false);
});
test("Ràng buộc xe, tuyến và vai trò", () => {
  const bus = {
    BienSo: "29B-001.01",
    MauXe: "Trắng",
    HangSanXuat: "Thaco",
    DoiXe: "2026",
    Model: "Mẫu",
    SoGhe: "45",
    SoNamSuDung: 0,
    NgayBaoDuongCuoiCung: "2026-11-07",
  };
  assert.equal(validate("buses", bus).SoGhe, 45);
  assert.throws(() => validate("buses", { ...bus, SoGhe: 1 }));
  assert.throws(() => validate("buses", { ...bus, SoGhe: "" }));
  assert.throws(() =>
    validate("routes", {
      MaTuyen: "T01",
      DiemDau: "A",
      DiemCuoi: "B",
      DoDai: 10,
      DoPhucTap: 4,
    }),
  );
  assert.throws(() =>
    validate("trips", {
      MaSoChuyenXe: "X",
      BienSo: "B",
      MaTuyen: "T",
      CMTLaiXe: "1",
      CMTPhuXe: "1",
      NgayThucHien: "2026-11-07",
      SoKhach: 1,
      GiaVe: 1000,
    }),
  );
});
test("Khoảng ngày không bị đảo", () => {
  assert.throws(() =>
    dateRange(
      { start: "2026-11-08", end: "2026-11-07" },
      { monthStart: "2026-11-01", today: "2026-11-07" },
    ),
  );
});
test("Tách SQL có DELIMITER, dấu chấm phẩy trong chuỗi và chú thích", () => {
  const text =
    "-- heading\nSELECT 'a;b';\nDELIMITER $$\nCREATE PROCEDURE p() BEGIN SELECT 1; SELECT 'x$$y'; END$$\nDELIMITER ;\nCALL p();";
  const parts = splitSql(text);
  assert.equal(parts.length, 3);
  assert.match(parts[1], /SELECT 1; SELECT/);
});
test("Nhập mẫu tiếng Việt giữ nguyên khóa và số 0 đầu", () => {
  const row = inputFields("drivers", {
    CMT: "001234",
    "Họ và tên": "Nguyễn An",
    "Số bằng lái": "GPLX01",
    "Loại bằng lái": "E",
    "Địa chỉ": "Hà Nội",
    "Ngày sinh": "1990-01-01",
    "Thâm niên": 5,
  });
  assert.equal(row.CMT, "001234");
  assert.equal(row.Ten, "Nguyễn An");
  assert.equal(row.MaSoBangLai, "GPLX01");
  assert.equal(validate("drivers", row).ThamNien, 5);
});
test("Tệp sao lưu phát hiện nội dung bị thay đổi", () => {
  const data = {
      format: "vanhanh-business-backup",
      version: 1,
      createdAt: "2026-11-07T12:00:00Z",
      tables: { buses: [], drivers: [], routes: [], trips: [] },
    },
    file = {
      buffer: Buffer.from(
        JSON.stringify({ ...data, checksum: checksum(data) }),
      ),
    };
  assert.equal(parseBackup(file).counts.buses, 0);
  const modified = { ...data, version: 2, checksum: checksum(data) };
  assert.throws(() =>
    parseBackup({ buffer: Buffer.from(JSON.stringify(modified)) }),
  );
});
