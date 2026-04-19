const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

/* GÜNCELLEME AYARLARI */
autoUpdater.autoDownload = false; // Kullanıcı basınca inecek
autoUpdater.autoInstallOnAppQuit = false;

let updaterInitialized = false;
let updaterWindow = null;

function setupUpdater(mainWindow) {
  updaterWindow = mainWindow;
  if (updaterInitialized) return;
  updaterInitialized = true;

  // 1. GÜNCELLEME VAR MI?
  autoUpdater.on("update-available", (info) => {
    // Sadece butonu görünür yap
    updaterWindow?.webContents.send("update_available", info.version);
  });

  // 2. KULLANICI BUTONA BASTI (İNDİRMEYİ BAŞLAT)
  ipcMain.on("install_update", () => {
    // Önce indir, sonra patcher'ı açacağız
    autoUpdater.downloadUpdate();
    // Renderer'a "İndiriliyor..." mesajı gönderilebilir (isteğe bağlı)
  });

  // 3. İNDİRME TAMAMLANDI (İŞTE ŞİMDİ PATCHER ZAMANI!)
  autoUpdater.on("update-downloaded", () => {
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

    // Patcher'ı bağımsız olarak başlat
    const child = spawn(updaterPath, [], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    // Ana uygulamayı kapat ki dosyalar kilitli kalmasın
    setTimeout(() => {
      app.quit();
    }, 500);
  });

  autoUpdater.on("error", (err) => {
    updaterWindow?.webContents.send("update_error", err.message);
  });
}

function checkForUpdates() {
  const { app } = require("electron");
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
