/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÜNCELLEME YÖNETİCİSİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modül İçe Aktarma ─────────────────── */

import { ipcMain, app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

/* ─────────────────── Durum Değişkenleri ─────────────────── */

let _mainWindow: BrowserWindow | null = null;
let _initialized = false;
let _updateReady = false;
let _launchHandler: (() => void) | null = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÜNCELLEME KURULUMU                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Güncelleyiciyi Başlat ─────────────────── */

function setupUpdater(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow;
  if (_initialized) return;
  _initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.channel = "latest";

  /* ─────────────────── Güncelleme Bulundu ─────────────────── */

  autoUpdater.on("update-available", (info: { version: string }) => {
    _mainWindow!.webContents.send("update_available", info.version);
  });

  /* ─────────────────── İndirme İlerlemesi ─────────────────── */

  autoUpdater.on("download-progress", (progressObj: { percent: number }) => {
    _mainWindow!.webContents.send("update_progress", progressObj.percent);
  });

  /* ─────────────────── İndirme Tamamlandı ─────────────────── */

  autoUpdater.on("update-downloaded", () => {
    _updateReady = true;
    _mainWindow!.webContents.send("update_downloaded");
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  autoUpdater.on("error", (err: Error) => {
    _mainWindow!.webContents.send("update_error", err.message);
  });

  /* ─────────────────── IPC: İndirmeyi Başlat ─────────────────── */

  _launchHandler = (): void => {
    if (_updateReady) {
      autoUpdater.quitAndInstall(true, true);
    } else {
      autoUpdater.downloadUpdate();
    }
  };

  ipcMain.on("launch_updater", _launchHandler);
}

/* ─────────────────── Temizleme ─────────────────── */

function teardownUpdater(): void {
  if (_launchHandler) {
    ipcMain.removeListener("launch_updater", _launchHandler);
    _launchHandler = null;
  }
}

/* ─────────────────── Güncelleme Kontrolü ─────────────────── */

function checkForUpdates(): void {
  if (!app.isPackaged) {
    console.log("[Updater] Development modunda, güncelleme kontrolü atlanıyor");
    return;
  }
  autoUpdater.checkForUpdates().catch(function () { return; });
}

/* ─────────────────── Dışa Aktarım ─────────────────── */

export { setupUpdater, checkForUpdates, teardownUpdater };
