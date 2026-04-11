const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;

// 1. Güncellemeyi otomatik indirme, biz butona basınca insin
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

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setMenu(null);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("app_version", app.getVersion());
    autoUpdater.checkForUpdates();
  });
}

// 2. Güncelleme bittiğinde HİÇBİR ŞEY SORMADAN kapat ve kur
autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall(false, true); // (sessiz, zorla başlat)
});

// 3. Yarım saatte bir sessiz kontrol
setInterval(
  () => {
    autoUpdater.checkForUpdates();
  },
  1000 * 60 * 30,
);

ipcMain.on("start_download", () => {
  autoUpdater.downloadUpdate();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
