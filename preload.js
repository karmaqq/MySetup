/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     PRELOAD - RENDERER API KÖPRÜSÜ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require("electron");

/* Her kanal için önceki listener'ı temizleyerek ekler (çift tetiklenmeyi önler) */
function onceListener(channel, handler) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  /* Uygulama versiyonu */
  onAppVersion: (cb) =>
    onceListener("app_version", (_e, version) => cb(version)),

  /* Güncelleme mevcut → UI'da butonu göster */
  onUpdateAvailable: (cb) =>
    onceListener("update_available", (_e, version) => cb(version)),

  /* Güncelleme hatası */
  onUpdateError: (cb) => onceListener("update_error", (_e, msg) => cb(msg)),

  /* Kullanıcı butona bastı → main process'e ilet */
  launchUpdater: () => ipcRenderer.send("launch_updater"),
});
