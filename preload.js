const { contextBridge, ipcRenderer } = require("electron");

function onceListener(channel, handler) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  onAppVersion: (cb) =>
    onceListener("app_version", (_e, version) => cb(version)),

  onUpdateAvailable: (cb) =>
    onceListener("update_available", (_e, version) => cb(version)),

  onUpdateProgress: (cb) =>
    onceListener("update_progress", (_e, percent) => cb(percent)),

  onUpdateDownloaded: (cb) => onceListener("update_downloaded", (_e) => cb()),

  onUpdateError: (cb) => onceListener("update_error", (_e, msg) => cb(msg)),

  launchUpdater: () => ipcRenderer.send("launch_updater"),
});
