/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     WINDOW GLOBAL TİP TANIMLARI                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Electron API (preload.js üzerinden) ─────────────────── */

interface ElectronAPI {
  onAppVersion(cb: (version: string) => void): void;
  onUpdateAvailable(cb: (version: string) => void): void;
  onUpdateProgress(cb: (percent: number) => void): void;
  onUpdateDownloaded(cb: () => void): void;
  onUpdateError(cb: (msg: string) => void): void;
  launchUpdater(): void;
}

interface Window {
  electronAPI: ElectronAPI;
  __FB_CONFIG__?: Record<string, string>;
  _viewingPostId: string | null;
}

/* ─────────────────── esbuild Tanımlamaları (Web) ─────────────────── */

declare var __APP_VERSION__: string | undefined;
declare var __IS_WEB__: boolean | undefined;
