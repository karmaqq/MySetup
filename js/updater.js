/* ═══════════════════════════════════════════════════════════════════════════ */
/* GÜNCELLEME YÖNETİCİSİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { ipcMain, app } = require("electron");
const { autoUpdater } = require("electron-updater");

let _mainWindow = null;
let _initialized = false;

/* ═══════════════════════════════════════════════════════════════════════════ */
/* GÜNCELLEME KURULUMU                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupUpdater(mainWindow) {
  _mainWindow = mainWindow;
  if (_initialized) return;
  _initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.channel = "latest";

  /* ─────────────────── Sayfa Yüklendiğinde Versiyon Gönder ─────────────────── */
  // UI'daki versionDisplay'i doldurmak için kritik
  _mainWindow.webContents.on("did-finish-load", () => {
    _mainWindow.webContents.send("app_version", app.getVersion());
  });

  /* ─────────────────── Güncelleme Bulundu ─────────────────── */
  autoUpdater.on("update-available", (info) => {
    _mainWindow.webContents.send("update_available", info.version);
  });

  /* ─────────────────── İndirme İlerlemesi ─────────────────── */
  autoUpdater.on("download-progress", (progressObj) => {
    _mainWindow.webContents.send("update_progress", progressObj.percent);
  });

  /* ─────────────────── İndirme Tamamlandı ─────────────────── */
  autoUpdater.on("update-downloaded", () => {
    _mainWindow.webContents.send("update_downloaded");

    // UI'daki "Yeniden Başlatılıyor" mesajının görünmesi için kısa bir rötar
    setTimeout(() => {
      // false: Uygulamayı hemen kapat ve kur, true: Kurulumdan sonra uygulamayı aç
      autoUpdater.quitAndInstall(false, true);
    }, 2000);
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */
  autoUpdater.on("error", (err) => {
    // UI tarafındaki onUpdateError bunu yakalayıp butonu kırmızı yapacak
    _mainWindow.webContents.send("update_error", err.message);
  });

  /* ─────────────────── IPC: İndirmeyi Başlat ─────────────────── */
  ipcMain.on("launch_updater", () => {
    autoUpdater.downloadUpdate();
  });
}

/* ─────────────────── Güncelleme Kontrolü ─────────────────── */
function checkForUpdates() {
  // Geliştirme aşamasında (localhost) güncelleyici hata verebilir, packaged kontrolü şart.
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Güncelleme kontrol hatası:", err);
    });
  }
}

module.exports = { setupUpdater, checkForUpdates };
