const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;

autoUpdater.autoDownload = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 950,
    title: "MySetup Inventory",
    backgroundColor: "#090b10",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Dosya ana klasöre geldiği için artık '..' kullanmıyoruz.
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setMenu(null);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("app_version", app.getVersion());
    autoUpdater.checkForUpdates();
  });
}

autoUpdater.on("update-available", (info) => {
  mainWindow.webContents.send("update_available", info.version);
});

autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall(false, true);
});

autoUpdater.on("error", (err) => {
  mainWindow.webContents.send("update_error", err.message);
});

ipcMain.on("start_download", () => {
  autoUpdater.downloadUpdate();
});

setInterval(
  () => {
    autoUpdater.checkForUpdates();
  },
  1000 * 60 * 30,
);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
