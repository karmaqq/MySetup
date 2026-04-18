/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     PRELOAD - RENDERER API KÖPRÜSÜ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onAppVersion: (callback) =>
    ipcRenderer.on("app_version", (_event, version) => callback(version)),

  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update_available", (_event, version) => callback(version)),

  onUpdateProgress: (callback) =>
    ipcRenderer.on("update_progress", (_event, percent) => callback(percent)),

  onUpdateReady: (callback) =>
    ipcRenderer.on("update_ready", (_event) => callback()),

  onUpdateError: (callback) =>
    ipcRenderer.on("update_error", (_event, message) => callback(message)),

  startDownload: () => ipcRenderer.send("start_download"),
});
