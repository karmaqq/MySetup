/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÜNCELLEME YÖNETİCİSİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modül İçe Aktarma ─────────────────── */

const { ipcMain, app } = require("electron");
const { autoUpdater } = require("electron-updater");

/* ─────────────────── Durum Değişkenleri ─────────────────── */

let _mainWindow = null;
let _initialized = false;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÜNCELLEME KURULUMU                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Güncelleyiciyi Başlat ─────────────────── */

function setupUpdater(mainWindow) {
  _mainWindow = mainWindow;
  if (_initialized) return;
  _initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.channel = "latest";

  /* ─────────────────── Sayfa Yüklendiğinde Versiyon Gönder ─────────────────── */

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
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 2000);
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  autoUpdater.on("error", (err) => {
    _mainWindow.webContents.send("update_error", err.message);
  });

  /* ─────────────────── IPC: İndirmeyi Başlat ─────────────────── */

  ipcMain.on("launch_updater", () => {
    autoUpdater.downloadUpdate();
  });
}

/* ─────────────────── Güncelleme Kontrolü ─────────────────── */

function checkForUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

/* ─────────────────── Dışa Aktarım ─────────────────── */

module.exports = { setupUpdater, checkForUpdates };
