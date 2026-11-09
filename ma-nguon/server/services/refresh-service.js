import { transaction } from "../config/database.js";
let lastRefresh = 0,
  lastDay = "",
  pending;
export async function refreshDerived(force = false) {
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  if (!force && day === lastDay && Date.now() - lastRefresh < 60000) return;
  if (pending) return pending;
  pending = transaction(
    async (connection) => {
      await connection.query("CALL P5_CapNhatNgayBaoDuong()");
      await connection.query("CALL P5_CapNhatLuongThang()");
      lastRefresh = Date.now();
      lastDay = day;
    },
    { business: true },
  );
  try {
    await pending;
  } finally {
    pending = null;
  }
}
export function invalidateRefresh() {
  lastRefresh = 0;
}
