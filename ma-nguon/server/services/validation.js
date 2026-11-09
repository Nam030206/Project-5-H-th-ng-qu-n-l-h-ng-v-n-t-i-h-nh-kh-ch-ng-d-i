import { z } from "zod";
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export function isDate(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export const dateSchema = z
  .string()
  .refine(isDate, "Ngày phải hợp lệ, có dạng YYYY-MM-DD");
const text = (max) =>
  z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .max(max, `Tối đa ${max} ký tự`);
const number = (min, max, integer = true) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    integer
      ? z.coerce.number().int("Phải là số nguyên").min(min).max(max)
      : z.coerce.number().min(min).max(max),
  );
export const entities = {
  buses: {
    table: "XE_KHACH",
    key: "BienSo",
    label: "Xe khách",
    search: ["BienSo", "MauXe", "HangSanXuat", "Model"],
    filters: ["HangSanXuat", "MauXe"],
    schema: z
      .object({
        BienSo: text(15),
        MauXe: text(30),
        HangSanXuat: text(50),
        DoiXe: text(30),
        Model: text(50),
        SoGhe: number(2, 32767),
        SoNamSuDung: number(0, 32767),
        NgayBaoDuongCuoiCung: dateSchema,
      })
      .strict(),
  },
  drivers: {
    table: "TAI_XE",
    key: "CMT",
    label: "Tài xế",
    search: ["CMT", "Ten", "MaSoBangLai", "DiaChi"],
    filters: ["LoaiBangLai"],
    schema: z
      .object({
        CMT: text(12),
        Ten: text(100),
        MaSoBangLai: text(20),
        LoaiBangLai: text(10),
        DiaChi: text(255),
        NgaySinh: dateSchema,
        ThamNien: number(0, 32767),
      })
      .strict(),
  },
  routes: {
    table: "TUYEN_DUONG",
    key: "MaTuyen",
    label: "Tuyến đường",
    search: ["MaTuyen", "DiemDau", "DiemCuoi"],
    filters: ["DoPhucTap"],
    schema: z
      .object({
        MaTuyen: text(10),
        DiemDau: text(100),
        DiemCuoi: text(100),
        DoDai: number(0.01, 999999.99, false),
        DoPhucTap: number(1, 3),
      })
      .strict(),
  },
  trips: {
    table: "CHUYEN_XE",
    key: "MaSoChuyenXe",
    label: "Chuyến xe",
    search: ["MaSoChuyenXe", "BienSo", "MaTuyen", "CMTLaiXe", "CMTPhuXe"],
    filters: ["BienSo", "MaTuyen"],
    schema: z
      .object({
        MaSoChuyenXe: text(10),
        BienSo: text(15),
        MaTuyen: text(10),
        CMTLaiXe: text(12),
        CMTPhuXe: text(12),
        NgayThucHien: dateSchema,
        SoKhach: number(0, 32767),
        GiaVe: number(0, 999999999999),
      })
      .strict()
      .refine((record) => record.CMTLaiXe !== record.CMTPhuXe, {
        message: "Lái chính và phụ xe phải là hai người khác nhau.",
        path: ["CMTPhuXe"],
      }),
  },
};
export function entityConfig(entity) {
  const value = entities[entity];
  if (!value) throw new AppError(404, "Không tìm thấy loại dữ liệu.");
  return value;
}
export function validate(entity, input) {
  return entityConfig(entity).schema.parse(input);
}
export function dateRange(query, clock) {
  const start = dateSchema.parse(query.start || clock.monthStart),
    end = dateSchema.parse(query.end || clock.today);
  if (start > end)
    throw new AppError(
      422,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.",
    );
  return { start, end };
}
export const pagination = (query) =>
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    })
    .parse(query);
export const accountSchema = z.object({
  TenDangNhap: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_.-]{3,50}$/,
      "Tên đăng nhập gồm 3–50 chữ, số hoặc dấu _ . -",
    ),
  HoTen: text(100),
  VaiTro: z.enum(["admin", "operator", "passenger"]),
  HoatDong: z.boolean().default(true),
  MatKhau: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .max(72, "Mật khẩu tối đa 72 ký tự"),
});
export const registrationSchema = accountSchema
  .pick({ TenDangNhap: true, HoTen: true, MatKhau: true })
  .extend({ XacNhanMatKhau: accountSchema.shape.MatKhau })
  .strict()
  .refine((input) => input.MatKhau === input.XacNhanMatKhau, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["XacNhanMatKhau"],
  });
