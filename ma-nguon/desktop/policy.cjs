function parseTripLink(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "vanhanh:" ||
      url.hostname !== "trip" ||
      url.search ||
      url.username ||
      url.password
    )
      return null;
    const id = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return id && id.length <= 10 && !/[<>\r\n/\\\u0000]/.test(id) ? id : null;
  } catch {
    return null;
  }
}
function allowExternal(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["www.openstreetmap.org", "openstreetmap.org"].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function trustedFrame(url, origin, setupUrl) {
  if (url === setupUrl) return true;
  try {
    return !!origin && new URL(url).origin === origin;
  } catch {
    return false;
  }
}
function trustedNavigation(url, origin, setupUrl, loadingUrl) {
  return url === loadingUrl || trustedFrame(url, origin, setupUrl);
}
module.exports = {
  parseTripLink,
  allowExternal,
  trustedFrame,
  trustedNavigation,
};
