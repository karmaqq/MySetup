/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          PATCHER ANA MANTIĞI                             */
/*                                                                           */
/*  Aşamalar:                                                                */
/*   1. GitHub Releases API → installer URL'sini bul                        */
/*   2. Installer'ı geçici klasöre indir (progress bar'lı)                  */
/*   3. NSIS installer'ı sessiz modda çalıştır (/S)                         */
/*   4. Ana uygulamayı başlat, kendini kapat                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");
const os = require("os");
const { spawn, execFile } = require("child_process");

/* ─── Command-line argümanlarını parse et ─────────────────────────────────── */

const argv = process.argv.slice(1);

function getArg(name) {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
}

const GITHUB_OWNER = getArg("--owner") || "karmaqq";
const GITHUB_REPO = getArg("--repo") || "MySetup";
const TARGET_VER = getArg("--version") || "";
const APP_DIR = getArg("--app-dir") || path.dirname(app.getPath("exe"));
const APP_EXE_NAME = getArg("--app-exe") || "MySetup.exe";

/* ─── Pencere referansı ───────────────────────────────────────────────────── */

let win = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Pencere Oluştur                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 300,
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
    /* Pencere hazır, güncellemeyi başlat */
    startUpdate();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Aşama Yönetimi                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {number} step    - 1..4
 * @param {'active'|'done'|'error'} state
 * @param {number} [progress] - 0-100, sadece indirme aşamasında
 */
function setStep(step, state, progress = null) {
  win?.webContents.send("step", { step, state, progress });
}

function setError(message) {
  win?.webContents.send("fatal_error", message);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Ana Güncelleme Akışı                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function startUpdate() {
  try {
    /* ── Adım 1: Sürüm bilgisini al ──────────────────────────────────────── */
    setStep(1, "active");
    const release = await fetchRelease();
    const installerUrl = findInstallerAsset(release);
    if (!installerUrl)
      throw new Error("Yükleyici dosyası bulunamadı (*.exe asset eksik).");
    await delay(600);
    setStep(1, "done");

    /* ── Adım 2: İndir ───────────────────────────────────────────────────── */
    setStep(2, "active", 0);
    const tmpPath = path.join(os.tmpdir(), `MySetup-Update-${Date.now()}.exe`);
    await downloadFile(installerUrl, tmpPath, (percent) => {
      setStep(2, "active", percent);
    });
    setStep(2, "done", 100);

    /* ── Adım 3: Kur ─────────────────────────────────────────────────────── */
    setStep(3, "active");
    await runInstaller(tmpPath);
    await delay(800);
    setStep(3, "done");

    /* ── Adım 4: Başlat ──────────────────────────────────────────────────── */
    setStep(4, "active");
    await delay(1000);
    launchApp();
    setStep(4, "done");

    await delay(1500);
    app.quit();
  } catch (err) {
    console.error("[Patcher] Hata:", err);
    setError(err.message || "Bilinmeyen hata oluştu.");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Yardımcı Fonksiyonlar                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** GitHub Releases API'den release nesnesini döndürür */
function fetchRelease() {
  return new Promise((resolve, reject) => {
    /* Belirli bir sürüm istendiyse onu, yoksa latest'i al */
    const apiPath = TARGET_VER
      ? `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${TARGET_VER}`
      : `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    const opts = {
      hostname: "api.github.com",
      path: apiPath,
      method: "GET",
      headers: {
        "User-Agent": `${GITHUB_REPO}-patcher/1.0`,
        Accept: "application/vnd.github.v3+json",
      },
      timeout: 15000,
    };

    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => {
        body += c;
      });
      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`GitHub API: HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error("API yanıtı ayrıştırılamadı."));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Bağlantı zaman aşımı."));
    });
    req.end();
  });
}

/** Release assets içinden .exe installer URL'sini döndürür */
function findInstallerAsset(release) {
  if (!release || !Array.isArray(release.assets)) return null;

  /* "MySetup-Installer.exe" veya herhangi bir .exe asset */
  const asset =
    release.assets.find((a) => a.name === "MySetup-Installer.exe") ||
    release.assets.find(
      (a) => a.name.endsWith(".exe") && !a.name.includes("update"),
    );

  return asset ? asset.browser_download_url : null;
}

/**
 * URL'den dosyayı indirir, redirect'leri takip eder.
 * @param {string}   url
 * @param {string}   dest
 * @param {function} onProgress - (percent: number) => void
 */
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    function doRequest(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        reject(new Error("Çok fazla yönlendirme."));
        return;
      }

      const mod = currentUrl.startsWith("https://") ? https : http;
      const req = mod.get(
        currentUrl,
        {
          headers: { "User-Agent": `${GITHUB_REPO}-patcher/1.0` },
        },
        (res) => {
          /* Redirect */
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            doRequest(res.headers.location, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`İndirme hatası: HTTP ${res.statusCode}`));
            return;
          }

          const total = parseInt(res.headers["content-length"] || "0", 10);
          let downloaded = 0;

          res.on("data", (chunk) => {
            downloaded += chunk.length;
            if (total > 0) {
              onProgress(Math.round((downloaded / total) * 100));
            }
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close(() => resolve());
          });
        },
      );

      req.on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("İndirme zaman aşımı."));
      });
    }

    doRequest(url);
  });
}

/**
 * NSIS installer'ı sessiz modda çalıştırır.
 * /S = silent, /D= hedef klasörü override (isteğe bağlı)
 */
function runInstaller(installerPath) {
  return new Promise((resolve, reject) => {
    /* /S = NSIS silent mode, /NCRC = checksum'ı atla */
    const args = ["/S", "/NCRC"];

    const child = spawn(installerPath, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });

    child.on("error", reject);

    /* NSIS installer'ı arka planda çalışır, biz süreci bırakıyoruz */
    child.unref();

    /* Installer başladıktan kısa süre sonra devam et */
    setTimeout(resolve, 4000);
  });
}

/** Ana uygulamayı başlatır */
function launchApp() {
  const exePath = path.join(APP_DIR, APP_EXE_NAME);

  try {
    const child = spawn(exePath, [], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (err) {
    console.error("[Patcher] Ana uygulama başlatılamadı:", err.message);
    /* Hata olsa bile patcher kapanır */
  }
}

/** ms kadar bekler */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Uygulama Yaşam Döngüsü                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

app.whenReady().then(createWindow);

app.on("will-quit", () => {
  ipcMain.removeAllListeners();
});
