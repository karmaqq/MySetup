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
let isAutoUpdateEnabled = false;

/* ─────────────────── Güncelleme Sistemi Kurulumu ─────────────────── */

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

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    updaterWindow?.webContents.send("update_progress", percent);
  });

  /* ─────────────────── GÜNCELLEME HAZIRLIK MANTIĞI ─────────────────── */

  autoUpdater.on("update-downloaded", async (info) => {
    const fs = require("fs-extra");
    const path = require("path");
    const { app } = require("electron");

    try {
      const pendingDir = path.join(app.getPath("userData"), "pending-update");

      // Klasörü temizle ve yeniden oluştur
      if (await fs.pathExists(pendingDir)) await fs.remove(pendingDir);
      await fs.ensureDir(pendingDir);

      // İndirilen kurulum dosyasını (installer) güvenli bölgeye kopyala
      const installerPath = info.downloadedFile;
      const destPath = path.join(pendingDir, "update-package.exe");
      await fs.copy(installerPath, destPath);

      // Renderer'a "Her şey hazır, butona basabilirsin" mesajı gönder
      updaterWindow?.webContents.send("update_ready");
    } catch (err) {
      console.error("Hazırlık hatası:", err);
      updaterWindow?.webContents.send("update_error", "Dosya hazırlanamadı.");
    }
  });

  autoUpdater.on("error", (err) => {
    updaterWindow?.webContents.send("update_error", err.message);
  });

  ipcMain.on("start_download", () => {
    autoUpdater.downloadUpdate();
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

/* ─────────────────── Güncelleme Kontrolü Başlatma ─────────────────── */

function checkForUpdates() {
  if (!require("electron").app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

module.exports = { setupUpdater, checkForUpdates };
