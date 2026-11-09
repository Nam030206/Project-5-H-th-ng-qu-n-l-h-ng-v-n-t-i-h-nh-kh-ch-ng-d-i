let csrfToken = "";
export function setCsrfToken(value) {
  csrfToken = value || "";
}
export function queryString(parameters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  return query.toString();
}
export async function api(
  path,
  { method = "GET", body, signal, download = false } = {},
) {
  const headers = {};
  if (!["GET", "HEAD"].includes(method)) headers["X-CSRF-Token"] = csrfToken;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    method,
    headers,
    body,
    signal,
    credentials: "include",
  });
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = { message: "Máy chủ chưa phản hồi. Vui lòng thử lại." };
    }
    const error = new Error(payload.message || "Không thể thực hiện thao tác.");
    error.status = response.status;
    error.details = payload.details;
    if (response.status === 401 && !path.includes("/login"))
      window.dispatchEvent(new CustomEvent("session-expired"));
    throw error;
  }
  return download ? response.blob() : response.json();
}
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function download(path, name, options = {}) {
  const blob = await api(path, { ...options, download: true });
  saveBlob(blob, name);
}
