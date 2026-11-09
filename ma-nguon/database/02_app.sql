CREATE TABLE IF NOT EXISTS APP_TAI_KHOAN (
  Id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  TenDangNhap VARCHAR(50) NOT NULL UNIQUE,
  HoTen VARCHAR(100) NOT NULL,
  MatKhauHash VARCHAR(100) NOT NULL,
  VaiTro ENUM('admin','operator','passenger') NOT NULL DEFAULT 'passenger',
  HoatDong BOOLEAN NOT NULL DEFAULT TRUE,
  NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS APP_PHIEN_DANG_NHAP (
  TokenHash CHAR(64) NOT NULL PRIMARY KEY,
  TaiKhoanId INT UNSIGNED NOT NULL,
  CsrfHash CHAR(64) NOT NULL,
  HetHan DATETIME NOT NULL,
  FOREIGN KEY (TaiKhoanId) REFERENCES APP_TAI_KHOAN(Id) ON DELETE CASCADE,
  INDEX ix_phien_het_han(HetHan)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS APP_NHAT_KY (
  Id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  TaiKhoanId INT UNSIGNED NULL,
  NguoiThucHien VARCHAR(100) NOT NULL,
  HanhDong VARCHAR(30) NOT NULL,
  DoiTuong VARCHAR(50) NOT NULL,
  MaBanGhi VARCHAR(100) NULL,
  TruocKhiSua JSON NULL,
  SauKhiSua JSON NULL,
  ThoiDiem DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (TaiKhoanId) REFERENCES APP_TAI_KHOAN(Id) ON DELETE SET NULL,
  INDEX ix_nhat_ky_ngay(ThoiDiem)
) ENGINE=InnoDB;

-- Nâng cấp tài khoản Người xem cũ; giữ mật khẩu và thu hồi phiên của vai trò cũ.
DROP PROCEDURE IF EXISTS P5_App_NangCapVaiTro;
DELIMITER $$
CREATE PROCEDURE P5_App_NangCapVaiTro()
BEGIN
  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='APP_TAI_KHOAN'
      AND COLUMN_NAME='VaiTro' AND COLUMN_TYPE LIKE '%viewer%'
  ) THEN
    ALTER TABLE APP_TAI_KHOAN
      MODIFY VaiTro ENUM('admin','operator','viewer','passenger') NOT NULL DEFAULT 'passenger';
    DELETE p FROM APP_PHIEN_DANG_NHAP p
      JOIN APP_TAI_KHOAN t ON t.Id=p.TaiKhoanId WHERE t.VaiTro='viewer';
    UPDATE APP_TAI_KHOAN SET VaiTro='passenger' WHERE VaiTro='viewer';
    ALTER TABLE APP_TAI_KHOAN
      MODIFY VaiTro ENUM('admin','operator','passenger') NOT NULL DEFAULT 'passenger';
  END IF;
END$$
DELIMITER ;
CALL P5_App_NangCapVaiTro();
DROP PROCEDURE P5_App_NangCapVaiTro;

CREATE TABLE IF NOT EXISTS APP_DANG_KY_CHUYEN (
  Id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  TaiKhoanId INT UNSIGNED NOT NULL,
  MaSoChuyenXe VARCHAR(10) NULL,
  SoLuong SMALLINT UNSIGNED NOT NULL,
  GiaVeDangKy DECIMAL(12,0) NOT NULL,
  TrangThai ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  NgayDangKy DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  NgayHuy DATETIME NULL,
  LyDoHuy VARCHAR(255) NULL,
  ThongTinChuyen JSON NOT NULL,
  CONSTRAINT fk_dang_ky_tai_khoan FOREIGN KEY (TaiKhoanId) REFERENCES APP_TAI_KHOAN(Id),
  CONSTRAINT fk_dang_ky_chuyen FOREIGN KEY (MaSoChuyenXe) REFERENCES CHUYEN_XE(MaSoChuyenXe) ON DELETE SET NULL,
  CONSTRAINT ck_dang_ky_so_luong CHECK (SoLuong BETWEEN 1 AND 32767),
  CONSTRAINT ck_dang_ky_gia_ve CHECK (GiaVeDangKy >= 0),
  UNIQUE KEY uq_dang_ky_chuyen (TaiKhoanId,MaSoChuyenXe),
  INDEX ix_dang_ky_trang_thai (TrangThai,MaSoChuyenXe),
  INDEX ix_dang_ky_tai_khoan (TaiKhoanId,NgayDangKy)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS p5_app_chuyen_bu;
DELIMITER $$
CREATE TRIGGER p5_app_chuyen_bu BEFORE UPDATE ON CHUYEN_XE FOR EACH ROW
BEGIN
  DECLARE so_cho_da_dang_ky INT DEFAULT 0;
  SELECT COALESCE(SUM(SoLuong),0) INTO so_cho_da_dang_ky
    FROM APP_DANG_KY_CHUYEN WHERE MaSoChuyenXe=OLD.MaSoChuyenXe AND TrangThai='confirmed';
  IF NEW.SoKhach < so_cho_da_dang_ky THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Tổng số khách không được nhỏ hơn số chỗ đã đăng ký.';
  END IF;
  IF so_cho_da_dang_ky > 0 AND (
    NEW.MaTuyen<>OLD.MaTuyen OR NEW.BienSo<>OLD.BienSo
    OR NEW.NgayThucHien<>OLD.NgayThucHien OR NEW.GiaVe<>OLD.GiaVe
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Chuyến đã có đăng ký. Hãy hủy đăng ký trước khi đổi tuyến, xe, ngày đi hoặc giá vé.';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS p5_app_tuyen_bu;
DELIMITER $$
CREATE TRIGGER p5_app_tuyen_bu BEFORE UPDATE ON TUYEN_DUONG FOR EACH ROW
BEGIN
  IF (NEW.DiemDau<>OLD.DiemDau OR NEW.DiemCuoi<>OLD.DiemCuoi) AND EXISTS (
    SELECT 1 FROM APP_DANG_KY_CHUYEN d JOIN CHUYEN_XE c ON c.MaSoChuyenXe=d.MaSoChuyenXe
    WHERE c.MaTuyen=OLD.MaTuyen AND d.TrangThai='confirmed'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Tuyến đã có hành khách đăng ký; không thể đổi điểm đầu hoặc điểm cuối.';
  END IF;
END$$
DELIMITER ;
