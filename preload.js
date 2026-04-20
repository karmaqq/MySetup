const { contextBridge, ipcRenderer } = require("electron");

// Mevcut dinleyiciyi temizleyip yenisini ekleyen yardımcı fonksiyon
function onceListener(channel, handler) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Versiyon Bilgisi
  onAppVersion: (cb) =>
    onceListener("app_version", (_e, version) => cb(version)),

  // Güncelleme Var Bildirimi
  onUpdateAvailable: (cb) =>
    onceListener("update_available", (_e, version) => cb(version)),

  // İndirme Yüzdesi (updater.js içindeki 'update_progress' ile eşlendi)
  onUpdateProgress: (cb) =>
    onceListener("update_progress", (_e, percent) => cb(percent)),

  // İndirme Tamamlandı Bildirimi
  onUpdateDownloaded: (cb) => onceListener("update_downloaded", (_e) => cb()),

  // Hata Bildirimi
  onUpdateError: (cb) => onceListener("update_error", (_e, msg) => cb(msg)),

  // Güncellemeyi Başlatma Emri
  launchUpdater: () => ipcRenderer.send("launch_updater"),
});
