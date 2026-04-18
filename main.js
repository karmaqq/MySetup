const { app, BrowserWindow } = require("electron");
const path = require("path");
const { setupUpdater, checkForUpdates } = require("./js/updater.js");

let mainWindow;

/* create window fonksiyon basligi */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 950,
    title: "MySetup Inventory",
    backgroundColor: "#090b10",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setMenu(null);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("app_version", app.getVersion());
    checkForUpdates();
  });

  setupUpdater(mainWindow);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
