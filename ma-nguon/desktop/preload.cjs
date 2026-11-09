const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    platform: process.platform,
    getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
    testConnection: (value) =>
      ipcRenderer.invoke("desktop:test-connection", value),
    connect: (value) => ipcRenderer.invoke("desktop:connect", value),
    configure: () => ipcRenderer.invoke("desktop:configure"),
    resume: () => ipcRenderer.invoke("desktop:resume"),
    bootstrap: () => ipcRenderer.invoke("desktop:bootstrap"),
    print: () => ipcRenderer.invoke("desktop:print"),
    savePdf: () => ipcRenderer.invoke("desktop:save-pdf"),
    onProgress: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("desktop:progress", listener);
      return () => ipcRenderer.removeListener("desktop:progress", listener);
    },
  }),
);
