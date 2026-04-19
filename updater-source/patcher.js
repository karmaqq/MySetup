/* ═══════════════════════════════════════════════════════════════════════════ */
/* PATCHER PROFESYONEL MANTIK                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

/* ─── Yapılandırma ve Argüman Yönetimi ────────────────────────────────────── */

const argv = process.argv.slice(1);
const getArg = (name) => {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
};

const CONFIG = {
  OWNER: getArg("--owner") || "karmaqq",
  REPO: getArg("--repo") || "MySetup",
  VERSION: getArg("--version") || "", // Boşsa 'latest' çekilir
  APP_DIR: getArg("--app-dir") || path.dirname(app.getPath("exe")),
  EXE_NAME: getArg("--app-exe") || "MySetup.exe",
  USER_AGENT: "MySetup-Patcher-Client/1.1",
};

let win = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Pencere Yönetimi                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 580,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: "#090b10",
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, "updater.html"));

  win.webContents.on("did-finish-load", () => {
    // Arayüz yüklendiğinde ufak bir bekleme ile süreci başlat
    setTimeout(startUpdate, 1000);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Görsel Geri Bildirim Yardımcıları                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const setStep = (step, state, progress = null) => {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("step", { step, state, progress });
};

const setError = (msg) => {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("fatal_error", msg);
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Ana Güncelleme Döngüsü                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function startUpdate() {
  let tempInstallerPath = "";

  try {
    /* ── ADIM 1: GitHub Release Bilgisi Çekme ── */
    setStep(1, "active");
    const release = await fetchGitHubRelease();
    const downloadUrl = findInstallerUrl(release);

    if (!downloadUrl)
      throw new Error("GitHub üzerinde kurulum dosyası (*.exe) bulunamadı.");
    setStep(1, "done");

    /* ── ADIM 2: Dosyayı Geçici Dizine İndirme ── */
    setStep(2, "active", 0);
    tempInstallerPath = path.join(
      os.tmpdir(),
      `setup_update_${Date.now()}.exe`,
    );

    await downloadFile(downloadUrl, tempInstallerPath, (percent) => {
      setStep(2, "active", percent);
    });
    setStep(2, "done", 100);

    /* ── ADIM 3: Kurulumu Başlatma (Silent Mode) ── */
    setStep(3, "active");
    // Ana uygulamanın kapandığından emin olmak için saniye tanı
    await sleep(1000);
    await executeInstaller(tempInstallerPath);
    setStep(3, "done");

    /* ── ADIM 4: Uygulamayı Yeniden Başlatma ── */
    setStep(4, "active");
    await sleep(1500);
    launchMainApp();
    setStep(4, "done");

    // Süreç tamamlandı, patcher'ı kapat
    setTimeout(() => app.quit(), 2000);
  } catch (err) {
    console.error("Güncelleme Hatası:", err);
    setError(err.message || "Beklenmeyen bir hata oluştu.");

    // Hata durumunda geçici dosyayı temizle
    if (tempInstallerPath && fs.existsSync(tempInstallerPath)) {
      fs.unlinkSync(tempInstallerPath);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Teknik İşlem Fonksiyonları                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function fetchGitHubRelease() {
  return new Promise((resolve, reject) => {
    const apiPath = CONFIG.VERSION
      ? `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/releases/tags/v${CONFIG.VERSION}`
      : `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/releases/latest`;

    const requestOptions = {
      hostname: "api.github.com",
      path: apiPath,
      headers: {
        "User-Agent": CONFIG.USER_AGENT,
        Accept: "application/vnd.github.v3+json",
      },
    };

    https
      .get(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API Hatası: ${res.statusCode}`));
          }
        });
      })
      .on("error", reject);
  });
}

function findInstallerUrl(release) {
  if (!release.assets) return null;
  // Önce "Installer.exe" içerenleri ara, yoksa ilk .exe'yi al
  const asset =
    release.assets.find(
      (a) =>
        a.name.toLowerCase().includes("installer") && a.name.endsWith(".exe"),
    ) ||
    release.assets.find(
      (a) => a.name.endsWith(".exe") && !a.name.includes("update"),
    );
  return asset ? asset.browser_download_url : null;
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (targetUrl) => {
      const protocol = targetUrl.startsWith("https") ? https : http;

      protocol
        .get(
          targetUrl,
          { headers: { "User-Agent": CONFIG.USER_AGENT } },
          (res) => {
            // Redirect (Yönlendirme) Yönetimi
            if (
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              return request(res.headers.location);
            }

            if (res.statusCode !== 200) {
              return reject(
                new Error(`Dosya indirilemedi: HTTP ${res.statusCode}`),
              );
            }

            const totalSize = parseInt(res.headers["content-length"], 10);
            let downloadedSize = 0;

            res.on("data", (chunk) => {
              downloadedSize += chunk.length;
              if (totalSize > 0) {
                onProgress(Math.round((downloadedSize / totalSize) * 100));
              }
            });

            res.pipe(file);

            file.on("finish", () => {
              file.close();
              resolve();
            });
          },
        )
        .on("error", (err) => {
          fs.unlink(dest, () => reject(err));
        });
    };

    request(url);
  });
}

function executeInstaller(installerPath) {
  return new Promise((resolve, reject) => {
    // /S: Silent, /NCRC: No CRC Check
    const args = ["/S", "/NCRC"];

    try {
      const process = spawn(installerPath, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });

      process.on("error", reject);
      process.unref();

      // NSIS yükleyicileri arka planda yeni süreç başlatır,
      // bu yüzden başladıktan sonra 5 saniye bekleyip devam ediyoruz.
      setTimeout(resolve, 5000);
    } catch (e) {
      reject(e);
    }
  });
}

function launchMainApp() {
  const fullPath = path.join(CONFIG.APP_DIR, CONFIG.EXE_NAME);
  if (!fs.existsSync(fullPath)) return;

  try {
    const child = spawn(fullPath, [], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (e) {
    console.error("Uygulama başlatılamadı:", e);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Uygulama Başlatma                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
