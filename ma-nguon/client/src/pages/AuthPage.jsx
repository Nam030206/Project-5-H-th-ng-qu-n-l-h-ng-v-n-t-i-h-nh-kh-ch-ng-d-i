import { useEffect, useState } from "react";
import {
  ArrowRight,
  BusFront,
  CheckCircle2,
  Eye,
  EyeOff,
  Route,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../lib/context";
import { api } from "../lib/api";
import { Brand } from "../components/Layout";
import { Button, ErrorBox, Field } from "../components/UI";
export default function AuthPage() {
  const { initialized, accept, startupError, initialize } = useAuth(),
    [form, setForm] = useState({
      username: "",
      password: "",
      confirmation: "",
      name: "",
      setupToken: "",
    }),
    [show, setShow] = useState(false),
    [mode, setMode] = useState("login"),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const registering = initialized && mode === "register",
    creating = !initialized || registering;
  useEffect(() => {
    if (!initialized && window.desktop)
      window.desktop
        .bootstrap()
        .then((value) => {
          if (value.setupToken)
            setForm((current) => ({
              ...current,
              setupToken: value.setupToken,
            }));
        })
        .catch(() =>
          setError(
            new Error(
              "Không khởi tạo được phiên thiết lập. Hãy mở lại ứng dụng.",
            ),
          ),
        );
  }, [initialized]);
  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  function switchMode(next) {
    setMode(next);
    setForm((current) => ({ ...current, password: "", confirmation: "" }));
    setShow(false);
    setError(null);
    setSuccess("");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (registering && form.password !== form.confirmation) {
      setError(new Error("Mật khẩu xác nhận không khớp."));
      return;
    }
    if (creating && new TextEncoder().encode(form.password).length > 72) {
      setError(
        new Error(
          "Mật khẩu tối đa 72 byte UTF-8. Vui lòng rút ngắn mật khẩu có dấu hoặc emoji.",
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess("");
    try {
      if (registering) {
        const result = await api("/api/auth/register", {
          method: "POST",
          body: {
            TenDangNhap: form.username,
            HoTen: form.name,
            MatKhau: form.password,
            XacNhanMatKhau: form.confirmation,
          },
        });
        setForm((current) => ({
          ...current,
          username: result.user.TenDangNhap,
          password: "",
          confirmation: "",
        }));
        setMode("login");
        setShow(false);
        setSuccess(result.message);
        return;
      }
      const result = initialized
        ? await api("/api/auth/login", {
            method: "POST",
            body: { username: form.username, password: form.password },
          })
        : await api("/api/auth/setup", {
            method: "POST",
            body: {
              setupToken: form.setupToken,
              account: {
                TenDangNhap: form.username,
                HoTen: form.name,
                MatKhau: form.password,
              },
            },
          });
      accept(result);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="auth-label">
            <span />
            MỖI HÀNH TRÌNH, MỘT KẾT NỐI
          </span>
          <h1>
            Vận hành thông suốt.
            <br />
            <span>Hành trình vững vàng.</span>
          </h1>
          <p>
            Một không gian để quản lý đội xe, kết nối nhân sự và theo dõi từng
            chuyến đi.
          </p>
          <div className="road-art">
            <div className="road-line road-one" />
            <div className="road-line road-two" />
            <div className="road-stop stop-one">
              <Route size={22} />
              <span>Khởi hành</span>
            </div>
            <div className="road-stop stop-two">
              <BusFront size={26} />
            </div>
            <div className="road-stop stop-three">
              <CheckCircle2 size={23} />
              <span>Đến nơi an toàn</span>
            </div>
          </div>
          <div className="auth-points">
            <span>
              <CheckCircle2 size={16} />
              Dữ liệu tập trung
            </span>
            <span>
              <CheckCircle2 size={16} />
              Báo cáo tức thời
            </span>
            <span>
              <CheckCircle2 size={16} />
              Thao tác đơn giản
            </span>
          </div>
        </div>
        <small>PROJECT 5 · QUẢN LÝ VẬN TẢI HÀNH KHÁCH ĐƯỜNG DÀI</small>
      </div>
      <div className="auth-form-side">
        <div className="auth-form">
          <div className="auth-form-icon">
            {registering ? <UserPlus size={26} /> : <ShieldCheck size={26} />}
          </div>
          <span className="eyebrow">CHÀO MỪNG ĐẾN VỚI VẬN HÀNH</span>
          <h2>
            {registering
              ? "Tạo tài khoản của bạn"
              : initialized
                ? "Đăng nhập tài khoản"
                : "Thiết lập quản trị viên"}
          </h2>
          <p className="muted">
            {registering
              ? "Đăng ký để tìm chuyến, giữ chỗ và quản lý hành trình của bạn."
              : initialized
                ? "Tiếp tục công việc và quản lý những hành trình của bạn."
                : "Tạo tài khoản đầu tiên để bắt đầu sử dụng hệ thống."}
          </p>
          <ErrorBox error={startupError} retry={initialize} />
          {success && (
            <div className="auth-success" role="status">
              <CheckCircle2 size={19} />
              <span>{success}</span>
            </div>
          )}
          <form onSubmit={submit} aria-busy={busy}>
            {creating && (
              <>
                <Field label="Họ và tên">
                  <input
                    autoComplete="name"
                    required
                    disabled={busy}
                    value={form.name}
                    onChange={change("name")}
                    placeholder="Nhập họ và tên của bạn"
                    maxLength={100}
                  />
                </Field>
                {!initialized && !window.desktop && (
                  <Field
                    label="Mã thiết lập"
                    hint="Nhận mã từ người cài đặt hệ thống."
                  >
                    <input
                      required
                      disabled={busy}
                      value={form.setupToken}
                      onChange={change("setupToken")}
                      placeholder="Nhập mã thiết lập lần đầu"
                    />
                  </Field>
                )}
              </>
            )}
            <Field
              label="Tên đăng nhập"
              hint={
                creating ? "3–50 chữ không dấu, số hoặc dấu _ . -" : undefined
              }
            >
              <input
                autoComplete="username"
                autoFocus
                required
                disabled={busy}
                pattern={creating ? "[a-zA-Z0-9_.\\-]{3,50}" : undefined}
                value={form.username}
                onChange={change("username")}
                placeholder="Nhập tên đăng nhập"
                maxLength={50}
              />
            </Field>
            <Field label="Mật khẩu">
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  aria-label="Mật khẩu"
                  autoComplete={creating ? "new-password" : "current-password"}
                  required
                  disabled={busy}
                  minLength={creating ? 8 : 1}
                  maxLength={72}
                  value={form.password}
                  onChange={change("password")}
                  placeholder={creating ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"}
                />
                <button
                  type="button"
                  disabled={busy}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {registering && (
              <>
                <Field label="Nhập lại mật khẩu">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    aria-label="Nhập lại mật khẩu"
                    required
                    disabled={busy}
                    minLength={8}
                    maxLength={72}
                    value={form.confirmation}
                    onChange={change("confirmation")}
                    placeholder="Nhập lại mật khẩu của bạn"
                  />
                </Field>
                <p className="auth-registration-note">
                  Tài khoản mới là Hành khách. Bạn có thể tìm chuyến, đăng ký
                  chỗ và quản lý các chuyến đã đăng ký.
                </p>
              </>
            )}
            <ErrorBox error={error} />
            <Button
              type="submit"
              loading={busy}
              disabled={!!startupError}
              icon={registering ? UserPlus : ArrowRight}
              className="w-full auth-submit"
            >
              {registering
                ? "Tạo tài khoản"
                : initialized
                  ? "Đăng nhập"
                  : "Tạo tài khoản & bắt đầu"}
            </Button>
          </form>
          {initialized && (
            <div className="auth-switch">
              <span>
                {registering ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
              </span>
              <button
                type="button"
                onClick={() => switchMode(registering ? "login" : "register")}
                disabled={busy || !!startupError}
              >
                {registering ? "Đăng nhập" : "Đăng ký"}
              </button>
            </div>
          )}
          <div className="auth-help">
            Cần hỗ trợ truy cập? Liên hệ quản trị viên của bạn.
          </div>
        </div>
        <small className="auth-copyright">
          Vận Hành © {new Date().getFullYear()} · Mọi hành trình trong tầm tay
        </small>
      </div>
    </div>
  );
}
