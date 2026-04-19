/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        GÜNCELLEME KONTROL SİSTEMİ                        */
/*                                                                           */
/*  Mimari:                                                                  */
/*   1. checkForUpdates() → GitHub API'ye sorar                             */
/*   2. Yeni sürüm varsa renderer'a "update_available" gönderir             */
/*   3. Kullanıcı butona basınca → update.exe spawn edilir, ana app kapanır */
/* ═══════════════════════════════════════════════════════════════════════════ */

const { ipcMain, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const https = require("https");

/* ─── Ayarlar ─────────────────────────────────────────────────────────────── */

const GITHUB_OWNER = "karmaqq";
const GITHUB_REPO = "MySetup";

/* ─── Durum ───────────────────────────────────────────────────────────────── */

let _mainWindow = null;
let _latestVersion = null;
let _initialized = false;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Kurulum                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupUpdater(mainWindow) {
  _mainWindow = mainWindow;
  if (_initialized) return;
  _initialized = true;

  /* Kullanıcı "Güncelle" butonuna bastı */
  ipcMain.on("launch_updater", () => {
    _launchUpdaterAndQuit();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  GitHub'dan Sürüm Kontrolü                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function checkForUpdates() {
  /* Geliştirme ortamında çalışma */
  if (!app.isPackaged) {
    console.log("[Updater] Dev modunda, güncelleme kontrolü atlandı.");
    return;
  }

  const currentVersion = app.getVersion();

  _fetchLatestRelease()
    .then((release) => {
      if (!release || !release.tag_name) return;

      /* "v1.7.8" → "1.7.8" */
      const latest = release.tag_name.replace(/^v/, "");
      _latestVersion = latest;

      if (_isNewer(latest, currentVersion)) {
        console.log(
          `[Updater] Yeni sürüm mevcut: ${latest} (mevcut: ${currentVersion})`,
        );
        _mainWindow?.webContents.send("update_available", latest);
      } else {
        console.log(`[Updater] Uygulama güncel: ${currentVersion}`);
      }
    })
    .catch((err) => {
      console.warn("[Updater] Sürüm kontrolü başarısız:", err.message);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Yardımcılar                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GitHub Releases API'den son sürümü çeker.
 * @returns {Promise<object>} release nesnesi
 */
function _fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: "GET",
      headers: {
        "User-Agent": `${GITHUB_REPO}-updater/${app.getVersion()}`,
        Accept: "application/vnd.github.v3+json",
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.end();
  });
}

/**
 * Semantic versioning karşılaştırması.
 * @param {string} latest  - "1.7.8"
 * @param {string} current - "1.7.7"
 * @returns {boolean}
 */
function _isNewer(latest, current) {
  const parse = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [lMaj, lMin, lPat] = parse(latest);
  const [cMaj, cMin, cPat] = parse(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

/**
 * update.exe'yi bağımsız olarak başlatır, ardından ana uygulamayı kapatır.
 * Patcher hangi sürümü indireceğini command-line argümanı olarak alır.
 */
function _launchUpdaterAndQuit() {
  /* update.exe'nin konumu */
  const updaterPath = app.isPackaged
    ? path.join(path.dirname(app.getPath("exe")), "update.exe")
    : path.join(
        __dirname,
        "..",
        "updater-source",
        "dist",
        "win-unpacked",
        "update.exe",
      );

  /* Patcher'a repo bilgisi ve hedef versiyon iletilir */
  const args = [
    "--owner",
    GITHUB_OWNER,
    "--repo",
    GITHUB_REPO,
    "--version",
    _latestVersion || "",
    "--app-dir",
    app.isPackaged ? path.dirname(app.getPath("exe")) : "",
    "--app-exe",
    "MySetup.exe",
  ];

  console.log("[Updater] Patcher başlatılıyor:", updaterPath, args.join(" "));

  try {
    const child = spawn(updaterPath, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    /* Kısa bekleme → patcher penceresi açılsın, sonra kapat */
    setTimeout(() => app.quit(), 800);
  } catch (err) {
    console.error("[Updater] Patcher başlatılamadı:", err.message);
    _mainWindow?.webContents.send(
      "update_error",
      "Güncelleyici başlatılamadı: " + err.message,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */

module.exports = { setupUpdater, checkForUpdates };
