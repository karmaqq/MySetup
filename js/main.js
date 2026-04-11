const { app, BrowserWindow } = require("electron");
const path = require("path");
const { setupUpdater, checkForUpdates } = require("./updater");

let mainWindow;

/* ─── PENCERE OLUŞTURMA ──────────────────────────────────────────────────────── */
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

  // Güncelleme olaylarını ve IPC kanallarını bir kez kur
  setupUpdater(mainWindow);

  mainWindow.webContents.on("did-finish-load", () => {
    // Renderer'a uygulama versiyonunu gönder
    mainWindow.webContents.send("app_version", app.getVersion());
    // Program açıldığında sessizce güncelleme kontrol et
    checkForUpdates();
  });
}

/* ─── UYGULAMA YAŞAM DÖNGÜSÜ ─────────────────────────────────────────────────── */
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
