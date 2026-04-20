const { ipcMain, app } = require("electron");
const { autoUpdater } = require("electron-updater");

let _mainWindow = null;
let _initialized = false;

function setupUpdater(mainWindow) {
  _mainWindow = mainWindow;
  if (_initialized) return;
  _initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.channel = "latest";

  // Sayfa yüklendiğinde versiyonu gönder
  _mainWindow.webContents.on("did-finish-load", () => {
    _mainWindow.webContents.send("app_version", app.getVersion());
  });

  autoUpdater.on("update-available", (info) => {
    _mainWindow.webContents.send("update_available", info.version);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    _mainWindow.webContents.send("update_progress", progressObj.percent);
  });

  autoUpdater.on("update-downloaded", () => {
    _mainWindow.webContents.send("update_downloaded");
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on("error", (err) => {
    _mainWindow.webContents.send("update_error", err.message);
  });

  ipcMain.on("launch_updater", () => {
    autoUpdater.downloadUpdate();
  });
}

function checkForUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
