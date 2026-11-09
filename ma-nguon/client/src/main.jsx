import React, { Component, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { Providers, useAuth } from "./lib/context";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import EntityPage from "./pages/EntityPage";
import Reports from "./pages/Reports";
import Maintenance from "./pages/Maintenance";
import Analytics from "./pages/Analytics";
import Schedule from "./pages/Schedule";
import DataImport from "./pages/DataImport";
import Accounts from "./pages/Accounts";
import Audit from "./pages/Audit";
import Backup from "./pages/Backup";
import PassengerTrips from "./pages/PassengerTrips";
import Bookings from "./pages/Bookings";
const QrLookup = lazy(() => import("./pages/QrLookup"));
const RouteMap = lazy(() => import("./pages/RouteMap"));
import Guide from "./pages/Guide";
import "./styles.css";
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="loading-full">
          <div className="utility-card">
            <h2>Không thể hiển thị màn hình</h2>
            <p>Vui lòng tải lại trang để tiếp tục.</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
function Allowed({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.VaiTro) ? children : <Navigate to="/" replace />;
}
function Application() {
  const { user, initializing } = useAuth();
  if (initializing)
    return (
      <div className="loading-full">
        <LoaderCircle size={23} className="spin" />
        Đang kết nối Vận Hành…
      </div>
    );
  if (!user) return <AuthPage />;
  if (user.VaiTro === "passenger")
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PassengerTrips />} />
          <Route path="chuyen-xe" element={<PassengerTrips />} />
          <Route path="chuyen-da-dang-ky" element={<Bookings />} />
          <Route path="huong-dan" element={<Guide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route
          path="xe-khach"
          element={<EntityPage key="buses" entity="buses" />}
        />
        <Route
          path="tai-xe"
          element={<EntityPage key="drivers" entity="drivers" />}
        />
        <Route
          path="tuyen-duong"
          element={<EntityPage key="routes" entity="routes" />}
        />
        <Route
          path="chuyen-xe"
          element={<EntityPage key="trips" entity="trips" />}
        />
        <Route path="lich-trinh" element={<Schedule />} />
        <Route path="dang-ky-hanh-khach" element={<Bookings />} />
        <Route path="bao-duong" element={<Maintenance />} />
        <Route path="bao-cao" element={<Reports />} />
        <Route path="phan-tich" element={<Analytics />} />
        <Route
          path="du-lieu"
          element={
            <Allowed roles={["admin", "operator"]}>
              <DataImport />
            </Allowed>
          }
        />
        <Route path="tra-cuu-qr" element={<QrLookup />} />
        <Route path="ban-do" element={<RouteMap />} />
        <Route
          path="tai-khoan"
          element={
            <Allowed roles={["admin"]}>
              <Accounts />
            </Allowed>
          }
        />
        <Route
          path="nhat-ky"
          element={
            <Allowed roles={["admin"]}>
              <Audit />
            </Allowed>
          }
        />
        <Route
          path="sao-luu"
          element={
            <Allowed roles={["admin"]}>
              <Backup />
            </Allowed>
          }
        />
        <Route path="huong-dan" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Providers>
          <Suspense
            fallback={
              <div className="loading-full">
                <LoaderCircle size={22} className="spin" />
                Đang mở tính năng…
              </div>
            }
          >
            <Application />
          </Suspense>
        </Providers>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
