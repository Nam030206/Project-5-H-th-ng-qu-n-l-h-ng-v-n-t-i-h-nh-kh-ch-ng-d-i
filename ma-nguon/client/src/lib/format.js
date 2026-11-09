export const number = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
export function money(value) {
  const source = value ?? 0;
  const integer =
    typeof source === "bigint"
      ? source
      : /^-?\d+(?:\.0+)?$/.test(String(source))
        ? BigInt(String(source).split(".")[0])
        : Number(source);
  return currencyFormatter.format(integer);
}
export function tripRevenue(passengers, fare) {
  const count = String(passengers || 0),
    price = String(fare || 0);
  return /^\d+$/.test(count) && /^\d+$/.test(price)
    ? BigInt(count) * BigInt(price)
    : 0n;
}
export function date(value) {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}
export const dateTime = (value) =>
  value ? `${date(value)} ${String(value).slice(11, 19)}` : "—";
export function shiftDate(value, days) {
  const parsed = new Date(`${value}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const roleLabels = {
  admin: "Quản trị viên",
  operator: "Nhân viên",
  passenger: "Hành khách",
};
export const fieldLabels = {
  BienSo: "Biển số",
  MauXe: "Màu xe",
  HangSanXuat: "Hãng sản xuất",
  DoiXe: "Đời xe",
  Model: "Model",
  SoGhe: "Số ghế",
  SoNamSuDung: "Số năm sử dụng",
  NgayBaoDuongCuoiCung: "Bảo dưỡng gần nhất",
  SoChoNgoiQuyDinh: "Chỗ chở khách",
  NgayBaoDuongTiepTheo: "Bảo dưỡng tiếp theo",
  CMT: "CMT",
  Ten: "Họ và tên",
  MaSoBangLai: "Số bằng lái",
  LoaiBangLai: "Loại bằng lái",
  DiaChi: "Địa chỉ",
  NgaySinh: "Ngày sinh",
  ThamNien: "Thâm niên",
  LuongThangHienTai: "Lương tháng hiện tại",
  MaTuyen: "Mã tuyến",
  DiemDau: "Điểm đầu",
  DiemCuoi: "Điểm cuối",
  DoDai: "Độ dài (km)",
  DoPhucTap: "Độ phức tạp",
  MaSoChuyenXe: "Mã chuyến",
  CMTLaiXe: "Lái chính",
  CMTPhuXe: "Phụ xe",
  NgayThucHien: "Ngày thực hiện",
  SoKhach: "Số khách",
  GiaVe: "Giá vé",
  DoanhThuChuyen: "Doanh thu chuyến",
  TenLaiXe: "Lái chính",
  TenPhuXe: "Phụ xe",
  SoChuyenLaiChinh: "Chuyến lái chính",
  SoChuyenPhuXe: "Chuyến phụ xe",
  NgayBatDau: "Từ ngày",
  NgayKetThuc: "Đến ngày",
  SoChuyen: "Số chuyến",
  TongSoKhach: "Tổng số khách",
  DoanhThu: "Doanh thu",
  TongKmLamViec: "Km làm việc",
  SoNgayGiam: "Ngày giảm theo km",
  SoNgayConLai: "Ngày còn lại",
  TrangThaiBaoDuong: "Trạng thái",
  TenBang: "Tên bảng",
  SoBanGhi: "Số bản ghi",
  TyLeSuDung: "Tỷ lệ sử dụng",
  NgayChayGanNhat: "Chạy gần nhất",
  SoNgayKhongHoatDong: "Ngày không hoạt động",
};
export function displayValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (key.startsWith("Ngay") || key === "HetHan") return date(value);
  if (/Luong|DoanhThu|GiaVe/.test(key)) return money(value);
  if (key === "TyLeSuDung") return `${number(value)}%`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
