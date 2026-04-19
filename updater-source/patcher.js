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
    updateStatus("Sistem kapatılıyor...", 20);
    await new Promise((r) => setTimeout(r, 3500)); // Ana uygulamanın kapanması için güvenli süre

    const pendingExe = path.join(
      app.getPath("userData"),
      "pending-update",
      "update-package.exe",
    );

    if (await fs.pathExists(pendingExe)) {
      updateStatus("Yeni sürüm yükleniyor...", 60);

      // Installer'ı sessiz modda (/S) başlat
      const installer = spawn(pendingExe, ["/S"], {
        detached: true,
        stdio: "ignore",
      });
      installer.unref();

      updateStatus("İşlem tamamlanıyor...", 90);
      await new Promise((r) => setTimeout(r, 4000)); // Kurulumun bitmesi için bekleme
    }

    updateStatus("Uygulama yeniden başlatılıyor...", 100);

    // Ana uygulamayı geri aç (Kurulum sonrası default yol)
    const mainExe = path.join(path.dirname(app.getPath("exe")), "MySetup.exe");
    spawn(mainExe, [], { detached: true, stdio: "ignore" }).unref();

    setTimeout(() => app.quit(), 1000);
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
