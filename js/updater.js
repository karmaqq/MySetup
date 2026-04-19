const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let updaterInitialized = false;
let updateIntervalId = null;
let updaterWindow = null;
let isAutoUpdateEnabled = false;

function setupUpdater(mainWindow) {
  updaterWindow = mainWindow;

  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.on("update-available", (info) => {
    updaterWindow?.webContents.send(
      "update_available",
      info.version,
      isAutoUpdateEnabled,
    );
  });

  autoUpdater.on("error", (err) => {
    updaterWindow?.webContents.send("update_error", err.message);
  });

  ipcMain.on("install_update", () => {
    const { spawn } = require("child_process");
    const path = require("path");
    const { app } = require("electron");

    const updaterPath = app.isPackaged
      ? path.join(path.dirname(app.getPath("exe")), "update.exe")
      : path.join(
          __dirname,
          "..",
          "updater-source",
          "dist",
          "win-unpacked",
          "update.exe",
        );

    const child = spawn(updaterPath, [], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();
    app.quit();
  });

  ipcMain.on("set_auto_update", (_event, enabled) => {
    isAutoUpdateEnabled = !!enabled;
  });

  updateIntervalId = setInterval(
    () => {
      autoUpdater.checkForUpdates();
    },
    1000 * 60 * 30,
  );
}

function checkForUpdates() {
  const { app } = require("electron");
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
