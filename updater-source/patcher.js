/* ═══════════════════════════════════════════════════════════════════════════ */
/* PATCHER ANA MANTIĞI                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");

let win;

/* ─────────────────── Patcher Penceresi ─────────────────── */

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 250,
    frame: false,
    resizable: false,
    backgroundColor: "#090b10",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("updater.html");

  // Pencere yüklendiğinde güncelleme işlemini başlat
  win.webContents.on("did-finish-load", () => {
    startUpdateProcess();
  });
}

/* ─────────────────── PATCHER ÇALIŞMA DÖNGÜSÜ ─────────────────── */

async function startUpdateProcess() {
  try {
    updateStatus("Güncelleme sunucusuna bağlanılıyor...", 10);
    await new Promise((r) => setTimeout(r, 2000));

    // BURADA: update.exe artık GitHub'dan dosyayı kendi indirebilir
    // veya basitlik için ana uygulamanın indirdiği paketi kurabilir.

    updateStatus("Yeni paket indiriliyor...", 40);
    // İndirme simülasyonu veya gerçek indirme kodları buraya...
    await new Promise((r) => setTimeout(r, 3000));

    updateStatus("Dosyalar değiştiriliyor...", 70);
    // Dosya taşıma işlemleri...

    updateStatus("Tamamlandı! Uygulama açılıyor...", 100);
    await new Promise((r) => setTimeout(r, 1500));

    const mainExe = path.join(path.dirname(app.getPath("exe")), "MySetup.exe");
    spawn(mainExe, [], { detached: true, stdio: "ignore" }).unref();
    app.quit();
  } catch (err) {
    updateStatus("Hata: " + err.message, 0);
  }
}

/* ─────────────────── Yardımcı Fonksiyonlar ─────────────────── */

function updateStatus(msg, percent) {
  if (win) {
    win.webContents.send("status", { msg, percent });
  }
}

app.whenReady().then(createWindow);
