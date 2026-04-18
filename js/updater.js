/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          OTOMATİK GÜNCELLEME                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let updaterInitialized = false;
let updateIntervalId = null;
let updaterWindow = null;

/* ─────────────────── Güncelleme Sistemi Kurulumu ─────────────────── */

function setupUpdater(mainWindow) {
  updaterWindow = mainWindow;

  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.on("update-available", (info) => {
    updaterWindow?.webContents.send("update_available", info.version);
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    updaterWindow?.webContents.send("update_progress", percent);
  });

  autoUpdater.on("update-downloaded", () => {
    updaterWindow?.webContents.send("update_ready");

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 1500);
  });

  autoUpdater.on("error", (err) => {
    updaterWindow?.webContents.send("update_error", err.message);
  });

  ipcMain.on("start_download", () => {
    autoUpdater.downloadUpdate();
  });

  updateIntervalId = setInterval(
    () => {
      autoUpdater.checkForUpdates();
    },
    1000 * 60 * 30,
  );
}

/* ─────────────────── Güncelleme Kontrolü Başlatma ─────────────────── */

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
