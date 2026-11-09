import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BusFront,
  CalendarDays,
  ChartColumnIncreasing,
  ChevronRight,
  ClipboardList,
  Database,
  FileClock,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Moon,
  PanelLeftClose,
  QrCode,
  Route,
  Search,
  ShieldCheck,
  Sun,
  Ticket,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../lib/context";
import { useData } from "../lib/hooks";
import { date, roleLabels } from "../lib/format";
import { Badge, IconButton } from "./UI";
const navigation = [
  {
    group: "KHÔNG GIAN LÀM VIỆC",
    items: [
      ["/", "Tổng quan", LayoutDashboard],
      ["/xe-khach", "Xe khách", BusFront],
      ["/tai-xe", "Tài xế", Users],
      ["/tuyen-duong", "Tuyến đường", Route],
      ["/chuyen-xe", "Chuyến xe", ClipboardList],
      ["/lich-trinh", "Lịch trình", CalendarDays],
      ["/dang-ky-hanh-khach", "Đăng ký hành khách", Ticket],
      ["/bao-duong", "Bảo dưỡng", Wrench],
      ["/bao-cao", "Báo cáo", ChartColumnIncreasing],
    ],
  },
  {
    group: "TIỆN ÍCH",
    items: [
      ["/phan-tich", "Phân tích vận hành", Activity],
      ["/du-lieu", "Nhập dữ liệu", Database, "write"],
      ["/tra-cuu-qr", "Tra cứu mã QR", QrCode],
      ["/ban-do", "Bản đồ tuyến", Map],
    ],
  },
  {
    group: "QUẢN TRỊ",
    items: [
      ["/tai-khoan", "Tài khoản", ShieldCheck, "admin"],
      ["/nhat-ky", "Nhật ký thao tác", FileClock, "admin"],
      ["/sao-luu", "Sao lưu & phục hồi", Database, "admin"],
    ],
  },
];
const passengerNavigation = [
  {
    group: "HÀNH TRÌNH CỦA BẠN",
    items: [
      ["/", "Tìm chuyến", Search],
      ["/chuyen-da-dang-ky", "Chuyến đã đăng ký", Ticket],
    ],
  },
];
export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <BusFront size={23} />
      </div>
      <div>
        <strong>
          Vận Hành<span>.</span>
        </strong>
        <small>QUẢN LÝ VẬN TẢI</small>
      </div>
    </div>
  );
}
export default function Layout() {
  const { user, logout } = useAuth(),
    [open, setOpen] = useState(false),
    [theme, setTheme] = useState(
      () => localStorage.getItem("vanhanh-theme") || "light",
    ),
    [term, setTerm] = useState(""),
    navigate = useNavigate(),
    location = useLocation();
  const passenger = user.VaiTro === "passenger",
    activeNavigation = passenger ? passengerNavigation : navigation,
    options = useData(passenger ? "/api/passenger/meta" : "/api/options");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vanhanh-theme", theme);
  }, [theme]);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  const current =
    activeNavigation
      .flatMap((group) => group.items)
      .find((item) => item[0] === location.pathname)?.[1] ||
    (location.pathname === "/chuyen-xe" && passenger
      ? "Tìm chuyến"
      : "Hướng dẫn");
  const initial = user.HoTen.split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <IconButton
            icon={X}
            label="Đóng menu"
            className="mobile-only"
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="workspace">
          <div className="workspace-icon">
            <Route size={18} />
          </div>
          <div>
            <strong>Hãng vận tải đường dài</strong>
            <small>
              {passenger
                ? "Cùng bạn trên mọi hành trình"
                : "Không gian quản lý · Project 5"}
            </small>
          </div>
          <ChevronRight size={14} />
        </div>
        <nav>
          {activeNavigation.map((group) => {
            const items = group.items.filter(
              (item) =>
                !item[3] ||
                (item[3] === "admin"
                  ? user.VaiTro === "admin"
                  : ["admin", "operator"].includes(user.VaiTro)),
            );
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.group}>
                <div className="nav-caption">{group.group}</div>
                {items.map(([path, label, Icon]) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/"}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""}`
                    }
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {path === "/chuyen-xe" && <span className="nav-dot" />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/huong-dan" className="nav-link">
            <HelpCircle size={18} />
            <span>Hướng dẫn sử dụng</span>
            <ArrowUpRight size={14} />
          </NavLink>
          <div className="sidebar-user">
            <div className="avatar">{initial}</div>
            <div>
              <strong>{user.HoTen}</strong>
              <small>{roleLabels[user.VaiTro]}</small>
            </div>
            <IconButton icon={LogOut} label="Đăng xuất" onClick={logout} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              icon={Menu}
              label="Mở menu"
              onClick={() => setOpen(!open)}
            />
            <span className="desktop-only">
              {passenger ? "Hành trình của bạn" : "Không gian làm việc"}
            </span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-right">
            <form
              className="top-search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(
                  (passenger ? "/?q=" : "/chuyen-xe?q=") +
                    encodeURIComponent(term),
                );
              }}
            >
              <Search size={16} />
              <input
                aria-label="Tìm chuyến xe"
                placeholder="Tìm chuyến xe…"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <IconButton
              icon={theme === "light" ? Moon : Sun}
              label={
                theme === "light"
                  ? "Chuyển giao diện tối"
                  : "Chuyển giao diện sáng"
              }
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            />
            <span className="topbar-separator" />
            <div className="date-chip">
              <CalendarDays size={15} />
              {date(options.data?.clock.today)}
            </div>
            <div className="avatar avatar-small">{initial}</div>
          </div>
        </header>
        <main className="main-content">
          <Outlet
            context={{
              options: options.data,
              reloadOptions: options.reload,
              clock: options.data?.clock,
            }}
          />
        </main>
        <footer className="app-footer">
          <span>Vận Hành · Hệ thống quản lý vận tải hành khách</span>
          <span className={`connection ${options.error ? "disconnected" : ""}`}>
            <i />
            {options.error
              ? "Chưa kết nối dữ liệu"
              : passenger
                ? "Lịch trình được cập nhật tự động"
                : "Dữ liệu MySQL · Cập nhật tự động"}
          </span>
        </footer>
      </div>
    </div>
  );
}
