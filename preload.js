/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     PRELOAD - RENDERER API KÖPRÜSÜ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require("electron");

function onceListener(channel, handler) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  onAppVersion: (callback) =>
    onceListener("app_version", (_event, version) => callback(version)),

  onUpdateAvailable: (callback) =>
    onceListener("update_available", (_event, version) => callback(version)),

  onUpdateProgress: (callback) =>
    onceListener("update_progress", (_event, percent) => callback(percent)),

  onUpdateReady: (callback) =>
    onceListener("update_ready", (_event) => callback()),

  onUpdateError: (callback) =>
    onceListener("update_error", (_event, message) => callback(message)),

  startDownload: () => ipcRenderer.send("start_download"),

  setAutoUpdate: (enabled) => ipcRenderer.send("set_auto_update", !!enabled),
});
