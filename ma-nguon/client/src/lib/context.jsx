import { createContext, useContext, useEffect, useState } from "react";
import { api, setCsrfToken } from "./api";
const AuthContext = createContext(null),
  ToastContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);
export function Providers({ children }) {
  const [user, setUser] = useState(null),
    [initializing, setInitializing] = useState(true),
    [initialized, setInitialized] = useState(true),
    [startupError, setStartupError] = useState(null),
    [toasts, setToasts] = useState([]);
  async function initialize() {
    setInitializing(true);
    setStartupError(null);
    try {
      const status = await api("/api/auth/status");
      setInitialized(status.initialized);
      if (status.initialized) {
        try {
          accept(await api("/api/auth/me"));
        } catch (error) {
          if (error.status !== 401) throw error;
        }
      }
    } catch (error) {
      setStartupError(error);
    } finally {
      setInitializing(false);
    }
  }
  function accept(result) {
    setUser(result.user);
    setCsrfToken(result.csrfToken);
    setInitialized(true);
  }
  useEffect(() => {
    initialize();
    const expire = () => {
      setUser(null);
      setCsrfToken("");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  function toast(message, type = "success") {
    const id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      5500,
    );
  }
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setCsrfToken("");
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        initialized,
        startupError,
        initialize,
        accept,
        logout,
      }}
    >
      <ToastContext.Provider value={toast}>
        {children}
        <div className="toast-region" aria-live="polite">
          {toasts.map((item) => (
            <div
              key={item.id}
              className={`toast ${item.type}`}
              role={item.type === "error" ? "alert" : "status"}
            >
              <span className="toast-dot" />
              {item.message}
              <button
                aria-label="Đóng thông báo"
                onClick={() =>
                  setToasts((current) =>
                    current.filter((value) => value.id !== item.id),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
