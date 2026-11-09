import { pool } from "../config/database.js";
import { clock, tripSelect } from "../dao/business-dao.js";
import { AppError, dateRange } from "./validation.js";
const salarySql = `SELECT tx.CMT,tx.Ten,COALESCE(p.SoChuyenLaiChinh,0) AS SoChuyenLaiChinh,COALESCE(p.SoChuyenPhuXe,0) AS SoChuyenPhuXe,tx.LuongThangHienTai FROM TAI_XE tx LEFT JOIN (
  SELECT CMT,SUM(VaiTro=2) AS SoChuyenLaiChinh,SUM(VaiTro=1) AS SoChuyenPhuXe FROM (
  SELECT CMTLaiXe AS CMT,2 AS VaiTro FROM CHUYEN_XE WHERE NgayThucHien BETWEEN DATE_FORMAT(CURDATE(),'%Y-%m-01') AND CURDATE()
  UNION ALL SELECT CMTPhuXe AS CMT,1 AS VaiTro FROM CHUYEN_XE WHERE NgayThucHien BETWEEN DATE_FORMAT(CURDATE(),'%Y-%m-01') AND CURDATE()) pc GROUP BY CMT
  ) p ON p.CMT=tx.CMT ORDER BY tx.CMT`;
export async function report(type, query = {}) {
  const current = await clock(),
    { start, end } = dateRange(query, current);
  let statement,
    parameters = [];
  switch (type) {
    case "salary":
      statement = salarySql;
      break;
    case "revenue":
      statement = `SELECT ? AS NgayBatDau,? AS NgayKetThuc,x.BienSo,x.HangSanXuat,x.Model,COALESCE(d.SoChuyen,0) AS SoChuyen,COALESCE(d.TongSoKhach,0) AS TongSoKhach,COALESCE(d.DoanhThu,0) AS DoanhThu FROM XE_KHACH x LEFT JOIN (SELECT BienSo,COUNT(*) AS SoChuyen,SUM(SoKhach) AS TongSoKhach,SUM(DoanhThuChuyen) AS DoanhThu FROM CHUYEN_XE WHERE NgayThucHien BETWEEN ? AND ? AND NgayThucHien<=CURDATE() GROUP BY BienSo) d ON d.BienSo=x.BienSo ORDER BY x.BienSo`;
      parameters = [start, end, start, end];
      break;
    case "maintenance":
      statement = `SELECT *,DATEDIFF(NgayBaoDuongTiepTheo,CURDATE()) AS SoNgayConLai,CASE WHEN NgayBaoDuongTiepTheo<CURDATE() THEN 'Quá hạn' WHEN NgayBaoDuongTiepTheo=CURDATE() THEN 'Đến hạn hôm nay' ELSE 'Chưa đến hạn' END AS TrangThaiBaoDuong FROM V_BAO_DUONG ORDER BY NgayBaoDuongTiepTheo,BienSo`;
      break;
    case "records":
      statement = `SELECT 'XE_KHACH' AS TenBang,COUNT(*) AS SoBanGhi FROM XE_KHACH UNION ALL SELECT 'TAI_XE',COUNT(*) FROM TAI_XE UNION ALL SELECT 'TUYEN_DUONG',COUNT(*) FROM TUYEN_DUONG UNION ALL SELECT 'CHUYEN_XE',COUNT(*) FROM CHUYEN_XE UNION ALL SELECT 'TONG_CONG',(SELECT COUNT(*) FROM XE_KHACH)+(SELECT COUNT(*) FROM TAI_XE)+(SELECT COUNT(*) FROM TUYEN_DUONG)+(SELECT COUNT(*) FROM CHUYEN_XE)`;
      break;
    case "passengers":
      statement = `SELECT td.MaTuyen,td.DiemDau,td.DiemCuoi,COUNT(cx.MaSoChuyenXe) AS SoChuyen,COALESCE(SUM(cx.SoKhach),0) AS TongSoKhach FROM TUYEN_DUONG td LEFT JOIN CHUYEN_XE cx ON cx.MaTuyen=td.MaTuyen AND cx.NgayThucHien BETWEEN ? AND ? AND cx.NgayThucHien<=CURDATE() GROUP BY td.MaTuyen,td.DiemDau,td.DiemCuoi ORDER BY TongSoKhach DESC,td.MaTuyen`;
      parameters = [start, end];
      break;
    case "occupancy":
      statement = `SELECT cx.MaSoChuyenXe,cx.NgayThucHien,cx.BienSo,cx.MaTuyen,cx.SoKhach,x.SoChoNgoiQuyDinh,ROUND(100.0*cx.SoKhach/NULLIF(x.SoChoNgoiQuyDinh,0),1) AS TyLeSuDung FROM CHUYEN_XE cx JOIN XE_KHACH x ON x.BienSo=cx.BienSo WHERE cx.NgayThucHien BETWEEN ? AND ? AND cx.NgayThucHien<=CURDATE() ORDER BY cx.NgayThucHien DESC,cx.MaSoChuyenXe`;
      parameters = [start, end];
      break;
    case "inactive": {
      const days = Number(query.days || 7);
      if (!Number.isInteger(days) || days < 1 || days > 3650)
        throw new AppError(422, "Số ngày phải từ 1 đến 3650.");
      statement = `SELECT x.BienSo,x.HangSanXuat,x.Model,k.NgayChayGanNhat,DATEDIFF(CURDATE(),k.NgayChayGanNhat) AS SoNgayKhongHoatDong FROM XE_KHACH x LEFT JOIN (SELECT BienSo,MAX(NgayThucHien) AS NgayChayGanNhat FROM CHUYEN_XE WHERE NgayThucHien<=CURDATE() GROUP BY BienSo) k ON k.BienSo=x.BienSo WHERE k.NgayChayGanNhat IS NULL OR DATEDIFF(CURDATE(),k.NgayChayGanNhat)>=? ORDER BY k.NgayChayGanNhat,x.BienSo`;
      parameters = [days];
      break;
    }
    default:
      throw new AppError(404, "Không tìm thấy báo cáo.");
  }
  const [rows] = await pool.query(statement, parameters);
  return {
    rows,
    clock: current,
    start: type === "salary" ? current.monthStart : start,
    end: type === "salary" ? current.today : end,
  };
}
export async function dashboard() {
  const current = await clock();
  const [[metrics], [trend], [upcoming], [maintenance], [routeRows]] =
    await Promise.all([
      pool.query(
        `SELECT (SELECT COUNT(*) FROM XE_KHACH) AS TongXe,(SELECT COUNT(*) FROM TAI_XE) AS TongTaiXe,COUNT(*) AS SoChuyen,COALESCE(SUM(SoKhach),0) AS SoKhach,COALESCE(SUM(DoanhThuChuyen),0) AS DoanhThu FROM CHUYEN_XE WHERE NgayThucHien BETWEEN DATE_FORMAT(CURDATE(),'%Y-%m-01') AND CURDATE()`,
      ),
      pool.query(
        `SELECT NgayThucHien AS Ngay,COUNT(*) AS SoChuyen,SUM(SoKhach) AS SoKhach,SUM(DoanhThuChuyen) AS DoanhThu FROM CHUYEN_XE WHERE NgayThucHien BETWEEN DATE_SUB(CURDATE(),INTERVAL 6 DAY) AND CURDATE() GROUP BY NgayThucHien ORDER BY NgayThucHien`,
      ),
      pool.query(
        tripSelect +
          " WHERE t.NgayThucHien>=CURDATE() ORDER BY t.NgayThucHien,t.MaSoChuyenXe LIMIT 6",
      ),
      pool.query(
        `SELECT BienSo,NgayBaoDuongTiepTheo,DATEDIFF(NgayBaoDuongTiepTheo,CURDATE()) AS SoNgayConLai FROM XE_KHACH ORDER BY NgayBaoDuongTiepTheo,BienSo LIMIT 4`,
      ),
      pool.query(
        `SELECT td.MaTuyen,td.DiemDau,td.DiemCuoi,COALESCE(SUM(cx.SoKhach),0) AS TongSoKhach FROM TUYEN_DUONG td LEFT JOIN CHUYEN_XE cx ON cx.MaTuyen=td.MaTuyen AND cx.NgayThucHien BETWEEN DATE_FORMAT(CURDATE(),'%Y-%m-01') AND CURDATE() GROUP BY td.MaTuyen,td.DiemDau,td.DiemCuoi ORDER BY TongSoKhach DESC LIMIT 4`,
      ),
    ]);
  return {
    clock: current,
    metrics: metrics[0],
    trend,
    upcoming,
    maintenance,
    routes: routeRows,
  };
}
