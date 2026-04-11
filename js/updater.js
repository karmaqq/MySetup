const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

autoUpdater.autoDownload = false;

/* ─── GÜNCELLEME OLAYLARINI VE IPC'YI AYARLA ───────────────────────────────── */
// mainWindow hazır olduktan sonra bir kez çağrılır.
function setupUpdater(mainWindow) {
  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("update_available", info.version);
  });

  // İndirme bittiği an HİÇBİR ŞEY SORMADAN programı kapat ve kur!
  autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (err) => {
    mainWindow.webContents.send("update_error", err.message);
  });

  ipcMain.on("start_download", () => {
    autoUpdater.downloadUpdate();
  });

  // Yarım saatte bir (30 dakika) sessiz kontrol döngüsü
  setInterval(
    () => {
      autoUpdater.checkForUpdates();
    },
    1000 * 60 * 30,
  );
}

/* ─── İLK KONTROL ────────────────────────────────────────────────────────────── */
// Program açıldığında did-finish-load içinden çağrılır.
function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
