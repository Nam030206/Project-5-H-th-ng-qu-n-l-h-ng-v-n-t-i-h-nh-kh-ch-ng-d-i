-- PROJECT 5 - YÊU CẦU 2 (ĐỦ CỘT NGÀY BẢO DƯỠNG VÀ LƯƠNG THÁNG HIỆN TẠI)
-- Hệ quản trị: MySQL 8.0.16 trở lên. Mã hóa: UTF-8.
-- Chạy toàn bộ file trong MySQL Workbench.
-- File dùng được cho CSDL mới và CSDL Project5_VanTai đã tạo từ bản trước.
-- CSDL đã có dữ liệu: bổ sung cột, thay các trigger/view của bài và giữ dữ liệu.
-- Dữ liệu mẫu chỉ được nhập khi cả bốn bảng nghiệp vụ đều rỗng.
-- XE_KHACH có trực tiếp cột DATE NgayBaoDuongTiepTheo.
-- TAI_XE có trực tiếp cột DECIMAL LuongThangHienTai (đơn vị: đồng).
-- Hai cột trên vẫn là thuộc tính dẫn xuất, được trigger tính và cập nhật.
-- Khi xem vào ngày khác, chạy các lệnh CALL ở mục 6 để làm mới theo lịch.
-- Bốn quan hệ 1:N vẫn được biểu diễn bằng bốn khóa ngoại của CHUYEN_XE.

SET NAMES utf8mb4;
SET SESSION time_zone = '+07:00';

CREATE DATABASE IF NOT EXISTS Project5_VanTai
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE Project5_VanTai;

-- 1. TẠO BẢNG / BỔ SUNG CỘT CHO CSDL CŨ

CREATE TABLE IF NOT EXISTS XE_KHACH (
    BienSo                  VARCHAR(15)  NOT NULL,
    MauXe                   VARCHAR(30)  NOT NULL,
    HangSanXuat             VARCHAR(50)  NOT NULL,
    DoiXe                   VARCHAR(30)  NOT NULL,
    Model                   VARCHAR(50)  NOT NULL,
    SoGhe                   SMALLINT     NOT NULL,
    SoNamSuDung             SMALLINT     NOT NULL,
    NgayBaoDuongCuoiCung     DATE         NOT NULL,
    SoChoNgoiQuyDinh        SMALLINT
        GENERATED ALWAYS AS (SoGhe - 2) VIRTUAL,
    NgayBaoDuongTiepTheo     DATE
        COMMENT 'Thuộc tính dẫn xuất, được các trigger tính và cập nhật',
    CONSTRAINT pk_xe_khach PRIMARY KEY (BienSo),
    CONSTRAINT ck_xe_so_ghe CHECK (SoGhe >= 2),
    CONSTRAINT ck_xe_so_nam CHECK (SoNamSuDung >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS TAI_XE (
    CMT                     VARCHAR(12)  NOT NULL,
    Ten                     VARCHAR(100) NOT NULL,
    MaSoBangLai             VARCHAR(20)  NOT NULL,
    LoaiBangLai             VARCHAR(10)  NOT NULL,
    DiaChi                  VARCHAR(255) NOT NULL,
    NgaySinh                DATE         NOT NULL,
    ThamNien                SMALLINT     NOT NULL,
    LuongThangHienTai       DECIMAL(20,0) NOT NULL DEFAULT 0
        COMMENT 'Lương từ đầu tháng đến ngày hiện tại, đơn vị: đồng',
    CONSTRAINT pk_tai_xe PRIMARY KEY (CMT),
    CONSTRAINT ck_tai_xe_tham_nien CHECK (ThamNien >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS TUYEN_DUONG (
    MaTuyen                 VARCHAR(10)  NOT NULL,
    DiemDau                 VARCHAR(100) NOT NULL,
    DiemCuoi                VARCHAR(100) NOT NULL,
    DoDai                   DECIMAL(8,2) NOT NULL COMMENT 'Đơn vị: km',
    DoPhucTap               TINYINT      NOT NULL,
    CONSTRAINT pk_tuyen_duong PRIMARY KEY (MaTuyen),
    CONSTRAINT ck_tuyen_do_dai CHECK (DoDai > 0),
    CONSTRAINT ck_tuyen_do_phuc_tap CHECK (DoPhucTap IN (1, 2, 3))
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS CHUYEN_XE (
    MaSoChuyenXe            VARCHAR(10)   NOT NULL,
    BienSo                  VARCHAR(15)   NOT NULL,
    MaTuyen                 VARCHAR(10)   NOT NULL,
    CMTLaiXe                VARCHAR(12)   NOT NULL,
    CMTPhuXe                VARCHAR(12)   NOT NULL,
    NgayThucHien            DATE          NOT NULL,
    SoKhach                 SMALLINT      NOT NULL,
    GiaVe                   DECIMAL(12,0) NOT NULL COMMENT 'Đơn vị: đồng/vé',
    DoanhThuChuyen          DECIMAL(20,0)
        GENERATED ALWAYS AS (SoKhach * GiaVe) VIRTUAL,
    CONSTRAINT pk_chuyen_xe PRIMARY KEY (MaSoChuyenXe),
    CONSTRAINT fk_chuyen_xe_xe FOREIGN KEY (BienSo)
        REFERENCES XE_KHACH (BienSo),
    CONSTRAINT fk_chuyen_xe_tuyen FOREIGN KEY (MaTuyen)
        REFERENCES TUYEN_DUONG (MaTuyen),
    CONSTRAINT fk_chuyen_xe_lai FOREIGN KEY (CMTLaiXe)
        REFERENCES TAI_XE (CMT),
    CONSTRAINT fk_chuyen_xe_phu FOREIGN KEY (CMTPhuXe)
        REFERENCES TAI_XE (CMT),
    CONSTRAINT ck_chuyen_so_khach CHECK (SoKhach >= 0),
    CONSTRAINT ck_chuyen_gia_ve CHECK (GiaVe >= 0),
    CONSTRAINT ck_chuyen_hai_nguoi CHECK (CMTLaiXe <> CMTPhuXe),
    INDEX ix_chuyen_ngay (NgayThucHien),
    INDEX ix_chuyen_xe_ngay (BienSo, NgayThucHien)
) ENGINE = InnoDB;

-- CREATE TABLE IF NOT EXISTS không tự thay đổi bảng đã tồn tại.
-- Vì vậy phải bổ sung cột riêng khi nâng cấp CSDL được tạo từ file cũ.
DROP PROCEDURE IF EXISTS P5_BoSungCotBaoDuong;
DELIMITER $$
CREATE PROCEDURE P5_BoSungCotBaoDuong()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND LOWER(TABLE_NAME) = 'xe_khach'
          AND COLUMN_NAME = 'NgayBaoDuongTiepTheo'
    ) THEN
        ALTER TABLE XE_KHACH
        ADD COLUMN NgayBaoDuongTiepTheo DATE
            COMMENT 'Thuộc tính dẫn xuất, được các trigger tính và cập nhật'
            AFTER SoChoNgoiQuyDinh;
    END IF;
END$$
DELIMITER ;
CALL P5_BoSungCotBaoDuong();
DROP PROCEDURE P5_BoSungCotBaoDuong;

DROP PROCEDURE IF EXISTS P5_BoSungCotLuong;
DELIMITER $$
CREATE PROCEDURE P5_BoSungCotLuong()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND LOWER(TABLE_NAME) = 'tai_xe'
          AND COLUMN_NAME = 'LuongThangHienTai'
    ) THEN
        ALTER TABLE TAI_XE
        ADD COLUMN LuongThangHienTai DECIMAL(20,0) NOT NULL DEFAULT 0
            COMMENT 'Lương từ đầu tháng đến ngày hiện tại, đơn vị: đồng'
            AFTER ThamNien;
    END IF;
END$$
DELIMITER ;
CALL P5_BoSungCotLuong();
DROP PROCEDURE P5_BoSungCotLuong;

-- 2. HỆ SỐ VÀ KHUNG NHÌN THÔNG TIN CHUYẾN
-- HỆ SỐ DO HỌC VIÊN LỰA CHỌN THEO QUYỀN CHO PHÉP TRONG ĐỀ
-- Cấp phức tạp 1, 2, 3 có hệ số lương lần lượt 1.00, 1.20, 1.50.
-- Phụ xe: 100.000 đồng/chuyến x hệ số lương tuyến.
-- Lái chính: 2 x 100.000 đồng/chuyến x hệ số lương tuyến.
-- Cấp phức tạp 1, 2, 3 có hệ số đường khó lần lượt 1.00, 1.30, 1.60.
-- Km làm việc của một chuyến = độ dài tuyến x hệ số đường khó.

CREATE OR REPLACE VIEW V_CHUYEN_XE AS
SELECT
    cx.MaSoChuyenXe, cx.BienSo, cx.MaTuyen,
    cx.CMTLaiXe, cx.CMTPhuXe, cx.NgayThucHien,
    cx.SoKhach, cx.GiaVe, cx.DoanhThuChuyen,
    td.DoPhucTap,
    CASE td.DoPhucTap
        WHEN 1 THEN 1.00
        WHEN 2 THEN 1.20
        WHEN 3 THEN 1.50
    END AS HeSoLuong,
    td.DoDai * CASE td.DoPhucTap
        WHEN 1 THEN 1.00
        WHEN 2 THEN 1.30
        WHEN 3 THEN 1.60
    END AS KmLamViec
FROM CHUYEN_XE AS cx
JOIN TUYEN_DUONG AS td ON td.MaTuyen = cx.MaTuyen;

-- 3. RÀNG BUỘC, CẬP NHẬT NGÀY BẢO DƯỠNG VÀ LƯƠNG THÁNG
-- Ngày tiếp theo = ngày cuối + 360 - FLOOR(tổng km làm việc / 100).
-- Chỉ cộng các chuyến từ lần bảo dưỡng gần nhất đến ngày hiện tại.
-- Quy ước bảo dưỡng hoàn tất đầu ngày; chuyến cùng ngày thuộc chu kỳ mới.
-- Trigger cập nhật khi thêm/sửa/xóa chuyến, đổi tuyến hoặc mốc bảo dưỡng.
-- Nếu có chuyến tương lai chuyển sang ngày thực hiện, gọi thủ tục làm mới
-- bên dưới trước khi xem bảng. File đã gọi thủ tục trước các kết quả cuối.
-- Lương tháng = tổng tiền từng chuyến từ đầu tháng đến hết CURDATE().
-- Mỗi chuyến: 100.000 x hệ số vai trò (lái chính 2, phụ xe 1) x hệ số lương.
-- Trigger tính lại khi thêm/sửa/xóa chuyến hoặc đổi độ phức tạp tuyến.
-- Chuyến tháng trước và chuyến tương lai không tính vào lương hiện tại.
-- Khi sang ngày/tháng mới, gọi P5_CapNhatLuongThang() trước khi xem bảng.
-- Lệnh SELECT riêng không kích hoạt trigger và không tự làm mới cột đã lưu.

DROP TRIGGER IF EXISTS trg_chuyen_xe_truoc_them;
DROP TRIGGER IF EXISTS trg_chuyen_xe_truoc_sua;
DROP TRIGGER IF EXISTS trg_xe_khach_truoc_sua;
DROP TRIGGER IF EXISTS trg_xe_khach_truoc_them;
DROP TRIGGER IF EXISTS trg_chuyen_xe_sau_them;
DROP TRIGGER IF EXISTS trg_chuyen_xe_sau_sua;
DROP TRIGGER IF EXISTS trg_chuyen_xe_sau_xoa;
DROP TRIGGER IF EXISTS trg_tuyen_duong_sau_sua;
DROP TRIGGER IF EXISTS trg_tai_xe_truoc_them;
DROP TRIGGER IF EXISTS trg_tai_xe_truoc_sua;
DROP PROCEDURE IF EXISTS P5_CapNhatNgayBaoDuong;
DROP PROCEDURE IF EXISTS P5_CapNhatLuongThang;

DELIMITER $$

-- Mỗi UPDATE dùng khóa chính, chạy được khi Workbench bật Safe Updates.
CREATE PROCEDURE P5_CapNhatNgayBaoDuong()
BEGIN
    DECLARE v_het BOOLEAN DEFAULT FALSE;
    DECLARE v_bien_so VARCHAR(15);
    DECLARE c_xe CURSOR FOR SELECT BienSo FROM XE_KHACH ORDER BY BienSo;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_het = TRUE;

    OPEN c_xe;
    lap_xe: LOOP
        FETCH c_xe INTO v_bien_so;
        IF v_het THEN
            LEAVE lap_xe;
        END IF;
        -- UPDATE kích hoạt trigger trg_xe_khach_truoc_sua để tính lại ngày.
        UPDATE XE_KHACH
        SET NgayBaoDuongTiepTheo = NgayBaoDuongTiepTheo
        WHERE BienSo = v_bien_so;
    END LOOP;
    CLOSE c_xe;
END$$

-- Cập nhật từng tài xế bằng khóa chính, tương thích Safe Updates.
CREATE PROCEDURE P5_CapNhatLuongThang()
BEGIN
    DECLARE v_het BOOLEAN DEFAULT FALSE;
    DECLARE v_cmt VARCHAR(12);
    DECLARE c_tai_xe CURSOR FOR SELECT CMT FROM TAI_XE ORDER BY CMT;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_het = TRUE;

    OPEN c_tai_xe;
    lap_tai_xe: LOOP
        FETCH c_tai_xe INTO v_cmt;
        IF v_het THEN
            LEAVE lap_tai_xe;
        END IF;
        -- Trigger BEFORE UPDATE tính lại giá trị dẫn xuất.
        UPDATE TAI_XE
        SET LuongThangHienTai = LuongThangHienTai
        WHERE CMT = v_cmt;
    END LOOP;
    CLOSE c_tai_xe;
END$$

CREATE TRIGGER trg_tai_xe_truoc_them
BEFORE INSERT ON TAI_XE
FOR EACH ROW
BEGIN
    -- Tài xế mới chưa thể có chuyến tham chiếu tới họ.
    SET NEW.LuongThangHienTai = 0;
END$$

CREATE TRIGGER trg_tai_xe_truoc_sua
BEFORE UPDATE ON TAI_XE
FOR EACH ROW
BEGIN
    DECLARE v_luong DECIMAL(20,0) DEFAULT 0;

    SELECT COALESCE(SUM(
        100000 * cx.HeSoLuong *
        CASE WHEN cx.CMTLaiXe = OLD.CMT THEN 2 ELSE 1 END
    ), 0) INTO v_luong
    FROM V_CHUYEN_XE AS cx
    WHERE (cx.CMTLaiXe = OLD.CMT OR cx.CMTPhuXe = OLD.CMT)
      AND cx.NgayThucHien BETWEEN
          CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE) AND CURDATE()
    FOR SHARE;

    SET NEW.LuongThangHienTai = v_luong;
END$$

CREATE TRIGGER trg_xe_khach_truoc_them
BEFORE INSERT ON XE_KHACH
FOR EACH ROW
BEGIN
    -- Xe mới chưa thể có chuyến tham chiếu tới nó.
    SET NEW.NgayBaoDuongTiepTheo = DATE_ADD(
        NEW.NgayBaoDuongCuoiCung, INTERVAL 360 DAY
    );
END$$
CREATE TRIGGER trg_chuyen_xe_truoc_them
BEFORE INSERT ON CHUYEN_XE
FOR EACH ROW
BEGIN
    DECLARE v_so_ghe SMALLINT DEFAULT NULL;

    SELECT SoGhe INTO v_so_ghe
    FROM XE_KHACH
    WHERE BienSo = NEW.BienSo
    FOR SHARE;

    IF v_so_ghe IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Xe được chỉ định không tồn tại.';
    END IF;

    IF NEW.SoKhach > v_so_ghe - 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số khách không được vượt quá số ghế trừ 2.';
    END IF;
END$$

CREATE TRIGGER trg_chuyen_xe_truoc_sua
BEFORE UPDATE ON CHUYEN_XE
FOR EACH ROW
BEGIN
    DECLARE v_so_ghe SMALLINT DEFAULT NULL;

    SELECT SoGhe INTO v_so_ghe
    FROM XE_KHACH
    WHERE BienSo = NEW.BienSo
    FOR SHARE;

    IF v_so_ghe IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Xe được chỉ định không tồn tại.';
    END IF;

    IF NEW.SoKhach > v_so_ghe - 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số khách không được vượt quá số ghế trừ 2.';
    END IF;
END$$

CREATE TRIGGER trg_xe_khach_truoc_sua
BEFORE UPDATE ON XE_KHACH
FOR EACH ROW
BEGIN
    DECLARE v_so_khach_lon_nhat SMALLINT DEFAULT 0;
    DECLARE v_tong_km DECIMAL(20,4) DEFAULT 0;

    IF NEW.SoGhe < OLD.SoGhe THEN
        SELECT COALESCE(MAX(SoKhach), 0) INTO v_so_khach_lon_nhat
        FROM CHUYEN_XE
        WHERE BienSo = OLD.BienSo
        FOR SHARE;

        IF v_so_khach_lon_nhat > NEW.SoGhe - 2 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Số ghế mới không đủ cho chuyến xe đã lưu.';
        END IF;
    END IF;

    -- Tính lại theo mốc bảo dưỡng mới và các chuyến đã thực hiện.
    SELECT COALESCE(SUM(cx.KmLamViec), 0) INTO v_tong_km
    FROM V_CHUYEN_XE AS cx
    WHERE cx.BienSo = OLD.BienSo
      AND cx.NgayThucHien >= NEW.NgayBaoDuongCuoiCung
      AND cx.NgayThucHien <= CURDATE()
    FOR SHARE;

    SET NEW.NgayBaoDuongTiepTheo = DATE_ADD(
        NEW.NgayBaoDuongCuoiCung,
        INTERVAL (360 - FLOOR(v_tong_km / 100)) DAY
    );
END$$

CREATE TRIGGER trg_chuyen_xe_sau_them
AFTER INSERT ON CHUYEN_XE
FOR EACH ROW
BEGIN
    UPDATE XE_KHACH
    SET NgayBaoDuongTiepTheo = NgayBaoDuongTiepTheo
    WHERE BienSo = NEW.BienSo;

    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = NEW.CMTLaiXe;
    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = NEW.CMTPhuXe;
END$$

CREATE TRIGGER trg_chuyen_xe_sau_sua
AFTER UPDATE ON CHUYEN_XE
FOR EACH ROW
BEGIN
    UPDATE XE_KHACH
    SET NgayBaoDuongTiepTheo = NgayBaoDuongTiepTheo
    WHERE BienSo = OLD.BienSo;
    IF NEW.BienSo <> OLD.BienSo THEN
        UPDATE XE_KHACH
        SET NgayBaoDuongTiepTheo = NgayBaoDuongTiepTheo
        WHERE BienSo = NEW.BienSo;
    END IF;

    -- Cập nhật cả người cũ lẫn người mới, kể cả trường hợp đổi vai trò.
    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = OLD.CMTLaiXe;
    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = OLD.CMTPhuXe;
    IF NEW.CMTLaiXe NOT IN (OLD.CMTLaiXe, OLD.CMTPhuXe) THEN
        UPDATE TAI_XE
        SET LuongThangHienTai = LuongThangHienTai
        WHERE CMT = NEW.CMTLaiXe;
    END IF;
    IF NEW.CMTPhuXe NOT IN (OLD.CMTLaiXe, OLD.CMTPhuXe) THEN
        UPDATE TAI_XE
        SET LuongThangHienTai = LuongThangHienTai
        WHERE CMT = NEW.CMTPhuXe;
    END IF;
END$$

CREATE TRIGGER trg_chuyen_xe_sau_xoa
AFTER DELETE ON CHUYEN_XE
FOR EACH ROW
BEGIN
    UPDATE XE_KHACH
    SET NgayBaoDuongTiepTheo = NgayBaoDuongTiepTheo
    WHERE BienSo = OLD.BienSo;

    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = OLD.CMTLaiXe;
    UPDATE TAI_XE
    SET LuongThangHienTai = LuongThangHienTai
    WHERE CMT = OLD.CMTPhuXe;
END$$

CREATE TRIGGER trg_tuyen_duong_sau_sua
AFTER UPDATE ON TUYEN_DUONG
FOR EACH ROW
BEGIN
    IF NEW.DoDai <> OLD.DoDai OR NEW.DoPhucTap <> OLD.DoPhucTap THEN
        CALL P5_CapNhatNgayBaoDuong();
    END IF;
    IF NEW.DoPhucTap <> OLD.DoPhucTap THEN
        CALL P5_CapNhatLuongThang();
    END IF;
END$$

DELIMITER ;

-- 4. DỮ LIỆU MẪU GIẢ LẬP: 6 XE, 6 TÀI XẾ, 6 TUYẾN, 20 CHUYẾN
-- Khi CSDL đã có dữ liệu, khối này giữ nguyên tất cả các bản ghi hiện tại.
SET @NgayHienTai = CURDATE();
DROP PROCEDURE IF EXISTS P5_NapDuLieuMau;
DELIMITER $$
CREATE PROCEDURE P5_NapDuLieuMau()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM XE_KHACH)
       AND NOT EXISTS (SELECT 1 FROM TAI_XE)
       AND NOT EXISTS (SELECT 1 FROM TUYEN_DUONG)
       AND NOT EXISTS (SELECT 1 FROM CHUYEN_XE) THEN
        START TRANSACTION;


INSERT INTO XE_KHACH
    (BienSo, MauXe, HangSanXuat, DoiXe, Model, SoGhe,
     SoNamSuDung, NgayBaoDuongCuoiCung)
VALUES
    ('29B-123.45', 'Trắng', 'Hyundai', '2019', 'Universe', 45, 7,
        DATE_SUB(@NgayHienTai, INTERVAL 30 DAY)),
    ('29B-234.56', 'Xanh', 'Thaco', '2018', 'TB120', 40, 8,
        DATE_SUB(@NgayHienTai, INTERVAL 370 DAY)),
    ('29B-345.67', 'Bạc', 'Samco', '2020', 'Felix', 34, 6,
        DATE_SUB(@NgayHienTai, INTERVAL 350 DAY)),
    ('29B-456.78', 'Đen', 'Thaco', '2022', 'TB79', 29, 4,
        DATE_SUB(@NgayHienTai, INTERVAL 360 DAY)),
    ('29B-567.89', 'Vàng', 'Hyundai', '2023', 'Universe', 45, 3,
        DATE_SUB(@NgayHienTai, INTERVAL 20 DAY)),
    ('29B-678.90', 'Đỏ', 'Thaco', '2021', 'Mobihome', 50, 5,
        DATE_SUB(@NgayHienTai, INTERVAL 60 DAY));

INSERT INTO TAI_XE
    (CMT, Ten, MaSoBangLai, LoaiBangLai, DiaChi, NgaySinh, ThamNien)
VALUES
    ('001085000001', 'Nguyễn Văn An', 'GPLX001', 'E', 'Hà Nội', '1985-03-12', 15),
    ('001087000002', 'Trần Văn Bình', 'GPLX002', 'E', 'Hải Phòng', '1987-07-20', 12),
    ('001089000003', 'Lê Văn Cường', 'GPLX003', 'E', 'Nam Định', '1989-11-08', 10),
    ('001084000004', 'Phạm Văn Dũng', 'GPLX004', 'E', 'Hà Nội', '1984-01-15', 16),
    ('001090000005', 'Hoàng Văn Em', 'GPLX005', 'E', 'Nghệ An', '1990-09-25', 9),
    ('001092000006', 'Vũ Văn Hải', 'GPLX006', 'E', 'Hà Nội', '1992-05-10', 7);

-- Độ dài các tuyến dưới đây là số liệu giả lập phục vụ bài tập.
INSERT INTO TUYEN_DUONG (MaTuyen, DiemDau, DiemCuoi, DoDai, DoPhucTap)
VALUES
    ('T01', 'Hà Nội', 'Hải Phòng', 120.00, 1),
    ('T02', 'Hà Nội', 'Nam Định', 90.00, 1),
    ('T03', 'Hà Nội', 'Vinh', 300.00, 2),
    ('T04', 'Hà Nội', 'Lào Cai', 320.00, 2),
    ('T05', 'Hà Nội', 'Sơn La', 300.00, 3),
    ('T06', 'Hà Nội', 'Điện Biên', 450.00, 3);

INSERT INTO CHUYEN_XE
    (MaSoChuyenXe, BienSo, MaTuyen, CMTLaiXe, CMTPhuXe,
     NgayThucHien, SoKhach, GiaVe)
VALUES
    ('CX001', '29B-123.45', 'T01', '001085000001', '001087000002', DATE_SUB(@NgayHienTai, INTERVAL 4 DAY), 40, 120000),
    ('CX002', '29B-123.45', 'T03', '001087000002', '001085000001', DATE_SUB(@NgayHienTai, INTERVAL 3 DAY), 35, 250000),
    ('CX003', '29B-123.45', 'T05', '001085000001', '001089000003', DATE_SUB(@NgayHienTai, INTERVAL 2 DAY), 30, 300000),
    ('CX004', '29B-123.45', 'T02', '001084000004', '001087000002', DATE_SUB(@NgayHienTai, INTERVAL 1 DAY), 43, 100000),
    ('CX005', '29B-123.45', 'T04', '001089000003', '001085000001', @NgayHienTai, 28, 280000),
    ('CX006', '29B-234.56', 'T03', '001087000002', '001084000004', DATE_SUB(@NgayHienTai, INTERVAL 20 DAY), 32, 250000),
    ('CX007', '29B-234.56', 'T06', '001084000004', '001087000002', DATE_SUB(@NgayHienTai, INTERVAL 10 DAY), 36, 450000),
    ('CX008', '29B-234.56', 'T01', '001090000005', '001089000003', DATE_SUB(@NgayHienTai, INTERVAL 3 DAY), 20, 120000),
    ('CX009', '29B-234.56', 'T04', '001087000002', '001090000005', DATE_SUB(@NgayHienTai, INTERVAL 1 DAY), 38, 280000),
    ('CX010', '29B-234.56', 'T02', '001085000001', '001084000004', @NgayHienTai, 25, 100000),
    ('CX011', '29B-345.67', 'T06', '001089000003', '001090000005', DATE_SUB(@NgayHienTai, INTERVAL 4 DAY), 30, 450000),
    ('CX012', '29B-345.67', 'T06', '001090000005', '001089000003', DATE_SUB(@NgayHienTai, INTERVAL 2 DAY), 32, 450000),
    ('CX013', '29B-345.67', 'T05', '001084000004', '001085000001', DATE_SUB(@NgayHienTai, INTERVAL 1 DAY), 28, 300000),
    ('CX014', '29B-345.67', 'T01', '001085000001', '001090000005', @NgayHienTai, 0, 120000),
    ('CX015', '29B-678.90', 'T06', '001084000004', '001089000003', DATE_SUB(@NgayHienTai, INTERVAL 90 DAY), 35, 450000),
    ('CX016', '29B-678.90', 'T02', '001089000003', '001084000004', DATE_SUB(@NgayHienTai, INTERVAL 35 DAY), 40, 100000),
    ('CX017', '29B-678.90', 'T04', '001090000005', '001087000002', DATE_SUB(@NgayHienTai, INTERVAL 8 DAY), 45, 280000),
    ('CX018', '29B-678.90', 'T03', '001087000002', '001089000003', DATE_SUB(@NgayHienTai, INTERVAL 2 DAY), 48, 250000),
    ('CX019', '29B-678.90', 'T05', '001089000003', '001084000004', DATE_SUB(@NgayHienTai, INTERVAL 1 DAY), 42, 300000),
    ('CX020', '29B-678.90', 'T06', '001090000005', '001085000001', @NgayHienTai, 44, 450000);

        COMMIT;

    END IF;
END$$
DELIMITER ;
CALL P5_NapDuLieuMau();
DROP PROCEDURE P5_NapDuLieuMau;

-- Lấp giá trị cho cột vừa bổ sung của CSDL cũ và làm mới theo ngày hiện tại.
CALL P5_CapNhatNgayBaoDuong();

-- 5. CÁC TRUY VẤN THEO ĐỀ

-- Truy vấn 1: tên các tài xế và lương từ đầu tháng đến hết ngày hiện tại.
-- UNION ALL giữ riêng từng lần tham gia, kể cả khi trùng người/hệ số.
-- LEFT JOIN và COALESCE bảo đảm tài xế chưa có chuyến có số chuyến 0.
-- Làm mới rồi đọc trực tiếp cột LuongThangHienTai đã lưu trong TAI_XE.

SET @NgayHienTai = CURDATE();
SET @DauThang = CAST(DATE_FORMAT(@NgayHienTai, '%Y-%m-01') AS DATE);
CALL P5_CapNhatLuongThang();

SELECT
    tx.CMT,
    tx.Ten,
    COALESCE(l.SoChuyenLaiChinh, 0) AS SoChuyenLaiChinh,
    COALESCE(l.SoChuyenPhuXe, 0) AS SoChuyenPhuXe,
    tx.LuongThangHienTai
FROM TAI_XE AS tx
LEFT JOIN (
    SELECT
        pc.CMT,
        SUM(pc.HeSoVaiTro = 2) AS SoChuyenLaiChinh,
        SUM(pc.HeSoVaiTro = 1) AS SoChuyenPhuXe
    FROM (
        SELECT CMTLaiXe AS CMT, 2 AS HeSoVaiTro
        FROM V_CHUYEN_XE
        WHERE NgayThucHien BETWEEN @DauThang AND @NgayHienTai
        UNION ALL
        SELECT CMTPhuXe AS CMT, 1 AS HeSoVaiTro
        FROM V_CHUYEN_XE
        WHERE NgayThucHien BETWEEN @DauThang AND @NgayHienTai
    ) AS pc
    GROUP BY pc.CMT
) AS l ON l.CMT = tx.CMT
ORDER BY tx.CMT;

-- Truy vấn 2: danh sách xe và doanh thu trong khoảng ngày bắt đầu/kết thúc.
-- Thay hai giá trị dưới đây bằng khoảng cần xem (ngày bắt đầu <= kết thúc).
-- Bao gồm hai ngày biên; chỉ tính chuyến đến ngày hiện tại.
-- Doanh thu = tổng (số khách x giá vé) của từng chuyến trong khoảng.
-- Hai cột ngày trên kết quả thể hiện khoảng báo cáo đã lựa chọn.
-- Có thể chạy riêng toàn bộ Truy vấn 2, gồm cả hai lệnh SET bên dưới.

SET @NgayBatDau = CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE);
SET @NgayKetThuc = CURDATE();
-- Ví dụ chọn khoảng khác: thay hai lệnh SET trên bằng:
-- SET @NgayBatDau = '2026-11-01';
-- SET @NgayKetThuc = '2026-11-06';

SELECT
    @NgayBatDau AS NgayBatDau,
    @NgayKetThuc AS NgayKetThuc,
    x.BienSo,
    x.HangSanXuat,
    x.Model,
    COALESCE(dt.SoChuyen, 0) AS SoChuyen,
    COALESCE(dt.TongSoKhach, 0) AS TongSoKhach,
    COALESCE(dt.DoanhThu, 0) AS DoanhThu
FROM XE_KHACH AS x
LEFT JOIN (
    SELECT
        BienSo,
        COUNT(*) AS SoChuyen,
        SUM(SoKhach) AS TongSoKhach,
        SUM(DoanhThuChuyen) AS DoanhThu
    FROM CHUYEN_XE
    WHERE NgayThucHien BETWEEN @NgayBatDau AND @NgayKetThuc
      AND NgayThucHien <= CURDATE()
    GROUP BY BienSo
) AS dt ON dt.BienSo = x.BienSo
ORDER BY x.BienSo;

-- Truy vấn 3: ngày bảo dưỡng tiếp theo của mỗi xe và danh sách quá hạn.
-- Chỉ cộng km của chuyến từ lần bảo dưỡng gần nhất đến ngày hiện tại.
-- Vì lưu DATE, quy ước bảo dưỡng hoàn tất đầu ngày; chuyến cùng ngày
-- thuộc chu kỳ mới. Không tính lại chuyến trước lần bảo dưỡng gần nhất.
-- Số ngày giảm = FLOOR(tổng km làm việc / 100), cộng km rồi mới làm tròn.
-- Ngày bảo dưỡng tiếp theo = ngày bảo dưỡng cuối + 360 - số ngày giảm.
-- Đây là hạn tính theo km đã thực hiện, chưa dự báo các chuyến tương lai.

CREATE OR REPLACE VIEW V_BAO_DUONG AS
SELECT
    k.BienSo,
    k.NgayBaoDuongCuoiCung,
    k.TongKmLamViec,
    FLOOR(k.TongKmLamViec / 100) AS SoNgayGiam,
    k.NgayBaoDuongTiepTheo
FROM (
    SELECT
        x.BienSo,
        x.NgayBaoDuongCuoiCung,
        x.NgayBaoDuongTiepTheo,
        COALESCE(SUM(cx.KmLamViec), 0) AS TongKmLamViec
    FROM XE_KHACH AS x
    LEFT JOIN V_CHUYEN_XE AS cx
        ON cx.BienSo = x.BienSo
       AND cx.NgayThucHien >= x.NgayBaoDuongCuoiCung
       AND cx.NgayThucHien <= CURDATE()
    GROUP BY x.BienSo, x.NgayBaoDuongCuoiCung, x.NgayBaoDuongTiepTheo
) AS k;

-- 3a. Toàn bộ xe, kể cả xe chưa có chuyến.
SELECT
    BienSo,
    NgayBaoDuongCuoiCung,
    TongKmLamViec,
    SoNgayGiam,
    NgayBaoDuongTiepTheo,
    CASE
        WHEN NgayBaoDuongTiepTheo < CURDATE() THEN 'Quá hạn'
        WHEN NgayBaoDuongTiepTheo = CURDATE() THEN 'Đến hạn hôm nay'
        ELSE 'Chưa đến hạn'
    END AS TrangThaiBaoDuong
FROM V_BAO_DUONG
ORDER BY NgayBaoDuongTiepTheo, BienSo;

-- 3b. Danh sách riêng những xe quá hạn. Đến hạn hôm nay chưa là quá hạn.
SELECT
    BienSo,
    NgayBaoDuongCuoiCung,
    TongKmLamViec,
    NgayBaoDuongTiepTheo,
    DATEDIFF(CURDATE(), NgayBaoDuongTiepTheo) AS SoNgayQuaHan
FROM V_BAO_DUONG
WHERE NgayBaoDuongTiepTheo < CURDATE()
ORDER BY NgayBaoDuongTiepTheo, BienSo;

-- Truy vấn 4: số bản ghi thực tế của từng bảng và toàn CSDL nghiệp vụ.
-- Chỉ đếm bốn bảng lưu trữ; không đếm lại dữ liệu của các khung nhìn.

SELECT 'XE_KHACH' AS TenBang, COUNT(*) AS SoBanGhi FROM XE_KHACH
UNION ALL
SELECT 'TAI_XE', COUNT(*) FROM TAI_XE
UNION ALL
SELECT 'TUYEN_DUONG', COUNT(*) FROM TUYEN_DUONG
UNION ALL
SELECT 'CHUYEN_XE', COUNT(*) FROM CHUYEN_XE
UNION ALL
SELECT 'TONG_CONG',
    (SELECT COUNT(*) FROM XE_KHACH)
    + (SELECT COUNT(*) FROM TAI_XE)
    + (SELECT COUNT(*) FROM TUYEN_DUONG)
    + (SELECT COUNT(*) FROM CHUYEN_XE);


-- 6. XEM TRỰC TIẾP DỮ LIỆU CỦA BỐN BẢNG
-- XE_KHACH trả về đủ 10 cột, gồm NgayBaoDuongTiepTheo.
-- TAI_XE trả về đủ 8 cột, gồm LuongThangHienTai.
-- Khi xem lại riêng phần này vào ngày khác, chạy cả hai lệnh CALL.
CALL P5_CapNhatNgayBaoDuong();
CALL P5_CapNhatLuongThang();
SELECT * FROM XE_KHACH ORDER BY BienSo;
SELECT * FROM TAI_XE ORDER BY CMT;
SELECT * FROM TUYEN_DUONG ORDER BY MaTuyen;
SELECT * FROM CHUYEN_XE ORDER BY MaSoChuyenXe;
