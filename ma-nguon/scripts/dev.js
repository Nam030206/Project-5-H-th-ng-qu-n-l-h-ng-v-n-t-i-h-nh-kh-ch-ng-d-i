import "dotenv/config";
import { spawn } from "node:child_process";
const children = [];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1000).unref();
}
const api = spawn(process.execPath, ["--watch", "server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.API_PORT || "3001" },
});
const web = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
children.push(api, web);
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    close(1);
  });
  child.on("exit", (code) => close(code || 0));
}
process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());
