/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ELECTRON ANA SÜREÇ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, shell, session, ipcMain } = require("electron");
const path = require("path");
const { setupUpdater, checkForUpdates } = require("./js/updater.js");
let mainWindow;

/* ─────────────────── CSP Başlık Tanımlaması ─────────────────── */

const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://*.googletagmanager.com https://*.firebaseio.com https://*.firebasedatabase.app",
  "script-src-elem 'self' https://www.gstatic.com https://*.googletagmanager.com https://*.firebaseio.com https://*.firebasedatabase.app",
  "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.googleapis.com https://*.gstatic.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://www.googleapis.com https://firebasestorage.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https://firebasestorage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

/* ─────────────────── CSP Header Kurulumu ─────────────────── */

function setupCspHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};

    responseHeaders["Content-Security-Policy"] = [APP_CSP];

    if (details.url.includes("firebasestorage.googleapis.com")) {
      responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      responseHeaders["Access-Control-Allow-Methods"] = ["GET, HEAD, OPTIONS"];
    }

    callback({ responseHeaders });
  });
}

/* ─────────────────── Pencere Oluşturma ─────────────────── */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
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

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("app_version", app.getVersion());
    checkForUpdates();
  });

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
  ipcMain.removeAllListeners();
});
