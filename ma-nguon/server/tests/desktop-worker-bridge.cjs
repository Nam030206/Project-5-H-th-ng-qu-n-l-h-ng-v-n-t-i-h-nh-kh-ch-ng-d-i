// Adapter IPC cho kiểm thử vòng đời service bằng Node.js, không đưa vào bản đóng gói.
const { registerHooks } = require("node:module");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "electron")
      return { url: "data:text/javascript,export const net={fetch:(...args)=>globalThis.fetch(...args)};", shortCircuit: true };
    return next(specifier, context);
  },
});
process.parentPort = {
  postMessage: (value) => process.send(value),
  on: (name, callback) => process.on(name, (data) => callback({ data })),
};
require("../../desktop/backend-service.cjs");
