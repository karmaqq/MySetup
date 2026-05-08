/*--- zorunlu - agents.md yorum kurallarina uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ELEKTRON IPC KOPRUSU                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require("electron");

/* ------------------- Tek Seferlik IPC Dinleyici ------------------- */

function onceListener(channel, handler) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.once(channel, (_e, ...args) => handler(...args));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    RENDERER'A ACILAN API                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

contextBridge.exposeInMainWorld("electronAPI", {
  /* ------------------- Uygulama Versiyonu ------------------- */

  onAppVersion: (cb) => onceListener("app_version", (version) => cb(version)),

  /* ------------------- Guncelleme Mevcut ------------------- */

  onUpdateAvailable: (cb) =>
    onceListener("update_available", (version) => cb(version)),

  /* ------------------- Indirme Ilerlemesi ------------------- */

  onUpdateProgress: (cb) => {
    ipcRenderer.removeAllListeners("update_progress");
    ipcRenderer.on("update_progress", (_e, percent) => cb(percent));
  },

  /* ------------------- Indirme Tamamlandi ------------------- */

  onUpdateDownloaded: (cb) => onceListener("update_downloaded", () => cb()),

  /* ------------------- Guncelleme Hatasi ------------------- */

  onUpdateError: (cb) => onceListener("update_error", (msg) => cb(msg)),

  /* ------------------- Guncelleme Baslat ------------------- */

  launchUpdater: () => ipcRenderer.send("launch_updater"),
});
