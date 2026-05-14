/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ELECTRON ANA SÜREÇ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  app,
  BrowserWindow,
  shell,
  session,
  ipcMain,
  globalShortcut,
} from "electron";
import * as path from "path";
const { setupUpdater, checkForUpdates, teardownUpdater } =
  require("./updater") as {
    setupUpdater: (w: BrowserWindow) => void;
    checkForUpdates: () => void;
    teardownUpdater: () => void;
  };

let mainWindow: BrowserWindow | null;

/* ─────────────────── CSP Başlık Tanımlaması ─────────────────── */

const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' https://*.firebaseio.com https://*.firebasedatabase.app",
  "script-src-elem 'self' https://*.firebaseio.com https://*.firebasedatabase.app",
  "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.googleapis.com https://*.gstatic.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://www.googleapis.com https://firebasestorage.googleapis.com",
  "style-src 'self' 'sha256-VryZe/ln5zX81OBvVb94mizaSFPBaY9dgq8ZghEzsFs=' 'sha256-s2C1AS5QUhTlHeRz92cC4HzZOg70F+82Pa/WvBzQIG8='",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

/* ─────────────────── CSP Header Kurulumu ─────────────────── */

function setupCspHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived(
    (
      details: Electron.OnHeadersReceivedListenerDetails,
      callback: (response: Electron.HeadersReceivedResponse) => void,
    ) => {
      const responseHeaders = details.responseHeaders || {};

      responseHeaders["Content-Security-Policy"] = [APP_CSP];

      if (details.url.includes("firebasestorage.googleapis.com")) {
        const origin = (details as any).requestHeaders
          ? (details as any).requestHeaders["Origin"] || ""
          : "";
        responseHeaders["Access-Control-Allow-Origin"] = [origin || "null"];
        responseHeaders["Access-Control-Allow-Methods"] = [
          "GET, HEAD, OPTIONS, PUT, POST, DELETE",
        ];
        responseHeaders["Access-Control-Allow-Headers"] = ["*"];
        responseHeaders["Access-Control-Allow-Credentials"] = ["true"];
      }

      callback({ responseHeaders });
    },
  );
}

/* ─────────────────── Pencere Oluşturma ─────────────────── */

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 900,
    minWidth: 950,
    title: "MySetup Inventory",
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#8a8f98",
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow!.loadFile(path.join(__dirname, "..", "index.html"));
  mainWindow!.setMenu(null);

  mainWindow!.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow!.webContents.on("did-finish-load", () => {
    mainWindow!.webContents.send("app_version", app.getVersion());
    checkForUpdates();
  });

  if (!app.isPackaged) {
    globalShortcut.register("F5", () => {
      if (mainWindow) mainWindow.reload();
    });
  }

  setupUpdater(mainWindow);
}

/* ─────────────────── UYGULAMA YAŞAM DÖNGÜSÜ ─────────────────── */

app.whenReady().then(() => {
  setupCspHeaders();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  teardownUpdater();
});
