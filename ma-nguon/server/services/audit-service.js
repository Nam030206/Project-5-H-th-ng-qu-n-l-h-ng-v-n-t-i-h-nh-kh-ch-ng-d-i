export async function audit(
  connection,
  user,
  action,
  entity,
  id,
  before = null,
  after = null,
) {
  await connection.execute(
    `INSERT INTO APP_NHAT_KY (TaiKhoanId,NguoiThucHien,HanhDong,DoiTuong,MaBanGhi,TruocKhiSua,SauKhiSua) VALUES (?,?,?,?,?,?,?)`,
    [
      user?.Id || null,
      user?.HoTen || "Thiết lập hệ thống",
      action,
      entity,
      id == null ? null : String(id),
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
    ],
  );
}
