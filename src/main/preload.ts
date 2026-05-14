/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ELEKTRON IPC KÖPRÜSÜ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { contextBridge, ipcRenderer } from "electron";

/* ─────────────────── Tek Seferlik IPC Dinleyici ─────────────────── */

var _onceFlags: Record<string, boolean> = {};

function onceListener(channel: string, handler: (...args: unknown[]) => void): void {
  if (_onceFlags[channel]) return;
  _onceFlags[channel] = true;
  ipcRenderer.once(channel, (_e: Electron.IpcRendererEvent, ...args: unknown[]) => handler(...args));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    RENDERER'A AÇILAN API                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

contextBridge.exposeInMainWorld("electronAPI", {
  /* ─────────────────── Uygulama Versiyonu ─────────────────── */

  onAppVersion: (cb: (version: string) => void) => onceListener("app_version", (version) => cb(version as string)),

  /* ─────────────────── Güncelleme Mevcut ─────────────────── */

  onUpdateAvailable: (cb: (version: string) => void) =>
    onceListener("update_available", (version) => cb(version as string)),

  /* ─────────────────── İndirme İlerlemesi ─────────────────── */

  onUpdateProgress: (cb: (percent: number) => void) => {
    ipcRenderer.on("update_progress", (_e: Electron.IpcRendererEvent, percent: number) => cb(percent));
  },

  /* ─────────────────── İndirme Tamamlandı ─────────────────── */

  onUpdateDownloaded: (cb: () => void) => onceListener("update_downloaded", () => cb()),

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  onUpdateError: (cb: (msg: string) => void) => onceListener("update_error", (msg) => cb(msg as string)),

  /* ─────────────────── Güncelleme Başlat ─────────────────── */

  launchUpdater: () => ipcRenderer.send("launch_updater"),
});
