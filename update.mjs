/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     MySetup — OTOMASYONLU YAYIN SİSTEMİ                   */
/*                      Kullanım: npm run update                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync, spawnSync, spawn } from "child_process";
import { createInterface } from "readline";
import { get } from "https";

/* ─────────────────── ANSI Renk Sabitleri ─────────────────── */

const R = "\x1b[0m";
const B = "\x1b[1m";
const D = "\x1b[2m";
const C = "\x1b[96m";
const G = "\x1b[92m";
const Y = "\x1b[93m";
const X = "\x1b[91m";
const M = "\x1b[95m";
const W = "\x1b[97m";
const L = "\x1b[94m";
const Z = "\x1b[90m";

/* ─────────────────── Yardımcı Fonksiyonlar ─────────────────── */

let rl = createInterface({ input: process.stdin, output: process.stdout });
let rlClosed = false;

function ensureRL() {
  if (rlClosed) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
    rlClosed = false;
  }
  return rl;
}

function closeRL() {
  rl.close();
  rlClosed = true;
}

const ask = (q) => new Promise((r) => ensureRL().question(q, r));

function exec(cmd) {
  return execSync(cmd, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
    .toString()
    .trim();
}

function execOk(cmd) {
  try {
    execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/* ─────────────────── UI Kemikleri ─────────────────── */

function box(w, color, top, mid, bot) {
  const h = "─".repeat(w);
  console.log(`   ${color}${B}${top}${h}${bot}${R}`);
}

function boxRow(color, content) {
  console.log(`   ${color}│${R} ${content} │${R}`);
}

/* ─────────────────── Bölüm Başlık ve Alt Bilgi ─────────────────── */

function stripAnsi(s) {
  return s.replace(/\x1b\[\d+m/g, "");
}

const W70 = 70;

function section(title, color = C) {
  const h = "─".repeat(W70);
  console.log(`   ${color}${B}┌${h}┐${R}`);
  console.log(`   ${color}${B}│  ${title.padEnd(W70 - 2)}│${R}`);
  console.log(`   ${color}${B}├${h}┤${R}`);
}

function sectionEnd(color = C) {
  const h = "─".repeat(W70);
  console.log(`   ${color}└${h}┘${R}`);
  console.log();
}

/* ─────────────────── Durum Satırı ─────────────────── */

function statusLine(icon, color, text, detail = "") {
  const raw = detail ? ` ${stripAnsi(detail)}` : "";
  const visLen = text.length + raw.length;
  const pad = Math.max(0, 65 - visLen);
  const isColored = detail && detail.includes("\x1b");
  const detailStr = detail
    ? ` ${isColored ? "" : Z}${detail}${isColored ? "" : R}`
    : "";
  console.log(
    `   ${C}│${R} ${color}${icon}${R}  ${text}${detailStr}${" ".repeat(pad)} ${C}│${R}`,
  );
}

function success(t, d) {
  statusLine("✓", G, t, d);
}
function warn(t, d) {
  statusLine("!", Y, t, d);
}
function error(t, d) {
  statusLine("✗", X, t, d);
}
function info(t, d) {
  statusLine("•", C, t, d);
}

function boxHeader(title, color = C) {
  const h = "═".repeat(W70);
  console.log(`   ${color}${B}╔${h}╗${R}`);
  console.log(`   ${color}${B}║  ${title.padEnd(W70 - 2)}║${R}`);
  console.log(`   ${color}${B}╚${h}╝${R}`);
  console.log();
}

/* ─────────────────── İç Çerçeve Satırı ─────────────────── */

function menuRow(color, content) {
  const pad = Math.max(0, W70 - 2 - stripAnsi(content).length);
  console.log(`   ${color}│${R} ${content}${" ".repeat(pad)} ${color}│${R}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            1/6 ÖN KONTROLLER                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function preflight() {
  section("[1/6]  ÖN KONTROLLER");
  let ok = true;

  if (!existsSync(".env.bat")) {
    error(".env.bat", "DOSYA YOK");
    ok = false;
  } else {
    const envContent = readFileSync(".env.bat", "utf-8");
    const m = envContent.match(/set "GH_TOKEN=([^"]+)"/);
    if (!m || !m[1].trim()) {
      error(".env.bat", "GH_TOKEN BOŞ");
      ok = false;
    } else {
      process.env.GH_TOKEN = m[1].trim();
      success(".env.bat", "GH_TOKEN yüklendi");
    }
  }

  try {
    const remote = exec("git remote get-url origin");
    const branch = exec("git branch --show-current");
    if (remote) {
      const short = remote.length > 44 ? remote.slice(0, 41) + "..." : remote;
      statusLine("✓", G, "Git deposu", `${Z}${short}${R} (${M}${branch}${Z})`);
    } else {
      error("Git deposu", "GİT BULUNAMADI");
      ok = false;
    }
  } catch {
    error("Git deposu", "GİT BULUNAMADI");
    ok = false;
  }

  try {
    success("Node.js", exec("node -v"));
  } catch {
    error("Node.js", "NODE BULUNAMADI");
    ok = false;
  }

  if (existsSync("node_modules/.bin/electron-builder.cmd"))
    success("electron-builder", "mevcut");
  else warn("electron-builder", "npm install gerekebilir");

  try {
    const pkg = readJson("package.json");
    const ghPublish = (pkg.build?.publish || []).find(
      (p) => p && p.provider === "github",
    );
    if (!ghPublish) {
      error("GitHub yayın ayarı", "build.publish bulunamadı");
      ok = false;
    } else if (ghPublish.owner !== "karmaqq" || ghPublish.repo !== "MySetup") {
      error("GitHub yayın ayarı", "owner/repo hatalı");
      ok = false;
    } else if (ghPublish.releaseType !== "release") {
      error("GitHub yayın tipi", "releaseType release olmalı");
      ok = false;
    } else {
      success("GitHub yayın tipi", "release");
    }
  } catch {
    error("package.json", "OKUNAMADI");
    ok = false;
  }

  if ((process.env.EP_DRAFT || "").toLowerCase() === "true") {
    error("EP_DRAFT", "true olamaz");
    ok = false;
  } else {
    success("EP_DRAFT", "kapalı");
  }

  if (process.env.GH_TOKEN) {
    try {
      const code = await httpGet(
        "https://api.github.com",
        {
          Authorization: `token ${process.env.GH_TOKEN}`,
          "User-Agent": "MySetup",
        },
        false,
      );
      if (code === 200) success("GitHub API", "erişim başarılı");
      else if (code === 401) {
        error("GitHub API", "401 Yetkisiz — TOKEN GEÇERSİZ");
        ok = false;
      } else warn("GitHub API", `HTTP ${code}`);
    } catch {
      warn("GitHub API", "bağlantı sorunu");
    }
  }

  if (!ok) {
    const h = "─".repeat(W70);
    console.log(`   ${C}├${h}┤${R}`);
    console.log(
      `   ${C}│${R}  ${X}${B}X  KRİTİK HATA — Lütfen yukarıdaki sorunları giderin.${R}           ${C}│${R}`,
    );
    console.log(`   ${C}└${h}┘${R}`);
    console.log();
    throw new Error("Ön kontroller başarısız");
  }

  success("Tüm kontroller başarılı");
  sectionEnd();
}

/* ─────────────────── HTTP İsteği ─────────────────── */

function httpGet(url, headers, parseJson = false) {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (parseJson) {
          let body = null;
          try {
            body = data ? JSON.parse(data) : null;
          } catch {
            body = data;
          }
          resolve({ statusCode: res.statusCode || 0, body });
        } else {
          resolve(res.statusCode);
        }
      });
    }).on("error", reject);
  });
}

/* ─────────────────── Versiyon Bütünlük Kontrolü ─────────────────── */

function verifyVersionIntegrity(cur) {
  try {
    const tags = exec('git tag --sort=-version:refname');
    if (!tags) return cur;
    const lastTag = tags.split("\n").filter(Boolean)[0];
    if (!lastTag) return cur;
    const m = lastTag.match(/^v?(\d+\.\d+\.\d+)/);
    if (!m) return cur;
    const [eMaj, eMin, ePat] = m[1].split(".").map(Number);
    const [cMaj, cMin, cPat] = cur.split(".").map(Number);
    const lastVal = eMaj * 100 + eMin * 10 + ePat;
    const curVal = cMaj * 100 + cMin * 10 + cPat;
    if (curVal > lastVal + 1) {
      const expected = `${eMaj}.${eMin}.${ePat + 1}`;
      warn("Versiyon atlaması", `${expected} olmalı, ${cur} bulundu`);
      const pkg = readJson("package.json");
      pkg.version = expected;
      writeJson("package.json", pkg);
      success("Versiyon düzeltildi", expected);
      return expected;
    }
  } catch {
    /* git tag okunamazsa sessizce geç */
  }
  return cur;
}

/* ─────────────────── Sürüm Yükseltme (otomatik yama) ─────────────────── */

async function selectVersion(cur) {
  cur = verifyVersionIntegrity(cur);
  const [vMaj, vMin, vPat] = cur.split(".").map(Number);
  let nvMaj = vMaj,
    nvMin = vMin,
    nvPat = vPat;
  if (nvPat === 9) {
    nvPat = 0;
    if (nvMin === 9) {
      nvMin = 0;
      nvMaj++;
    } else nvMin++;
  } else nvPat++;
  const nxt = `${nvMaj}.${nvMin}.${nvPat}`;

  section("[2/6]  VERSİYON GÜNCELLEME");
  menuRow(
    C,
    `${G}Sürüm Güncellendi${R} — ${W}${cur}${R} ${Z}→${R} ${G}${B}${nxt}${R}`,
  );
  menuRow(C, `${Z}package.json dosyası güncellendi${R}`);
  sectionEnd();

  const pkg = readJson("package.json");
  pkg.version = nxt;
  writeJson("package.json", pkg);
  return nxt;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            3/6 TYPE SCRIPT DERLEME                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function buildTs() {
  section("[3/6]  TYPE SCRIPT DERLEME");

  const bar = (pct) => {
    const f = Math.floor(pct / 5);
    return `${G}█${R}`.repeat(f) + `${Z}░${R}`.repeat(20 - f);
  };

  // 1. Animasyon 0→50
  for (let p = 0; p <= 50; p += 5) {
    const c = `${C}🔨 Derleniyor...${R} ${Z}[${bar(p)}]${R} ${Y}${p}%${R}`;
    const pad = Math.max(0, W70 - 2 - stripAnsi(c).length);
    process.stdout.write(`   ${C}│${R} ${c}${" ".repeat(pad)} ${C}│${R}\r`);
    await new Promise((r) => setTimeout(r, 4));
  }

  const result = spawnSync("cmd", ["/c", "npm run build:ts"], {
    encoding: "utf-8",
    windowsHide: true,
  });

  // 2. Animasyon 55→100
  for (let p = 55; p <= 100; p += 5) {
    const c = `${G}✓ Derlendi${R} ${Z}[${bar(p)}]${R} ${G}${p}%${R}`;
    const pad = Math.max(0, W70 - 2 - stripAnsi(c).length);
    process.stdout.write(`   ${C}│${R} ${c}${" ".repeat(pad)} ${C}│${R}\r`);
    await new Promise((r) => setTimeout(r, 3));
  }
  console.log();

  if (result.status !== 0) {
    menuRow(C, `${X}${B}X  DERLEME HATASI${R}`);
    menuRow(C, `${Z}Yayın iptal edildi. Önce hatayı düzeltip tekrar dene.${R}`);
    sectionEnd();
    return false;
  }

  sectionEnd();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            4/6  GİT İŞLEMLERİ                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function gitOperations(nxt, commitArg) {
  section("[4/6]  GİT İŞLEMLERİ");

  menuRow(C, `${Z}DURUM  DOSYA YOLU${R}`);
  console.log(`   ${C}│${R}  ${D}${"─".repeat(W70 - 4)}${R}  ${C}│${R}`);

  const statusOut = exec("git status --short");
  let hasChanges = false;

  for (const line of statusOut.split("\n")) {
    if (!line.trim()) continue;
    hasChanges = true;
    const st = line.slice(0, 2).trim();
    const file = line.slice(3).trim();
    let label = `${G}EKLENDİ${R}`;
    if (st === "M") label = `${Y}DEĞİŞTİ${R}`;
    if (st === "MM") label = `${Y}DEĞİŞTİ${R}`;
    if (st === "A") label = `${G}YENİ${R}`;
    if (st === "D") label = `${X}SİLİNDİ${R}`;
    if (st === "R") label = `${M}TAŞINDI${R}`;
    const visible = stripAnsi(label).length + 5 + file.length;
    const pad = Math.max(0, W70 - 2 - visible);
    console.log(
      `   ${C}│${R} ${label} ${Z}--${R} ${file}${" ".repeat(pad)}  ${C}│${R}`,
    );
  }

  if (!hasChanges) menuRow(C, `${Z}Temiz çalışma dizini, değişiklik yok.${R}`);

  console.log(`   ${C}│${R}  ${D}${"─".repeat(W70 - 4)}${R}  ${C}│${R}`);

  let finalMsg;
  if (commitArg !== undefined) {
    finalMsg = commitArg || "Otomatik Güncelleme";
    menuRow(C, `${Z}Commit: ${W}v${nxt}: ${finalMsg}${R}`);
  } else {
    const dftMsg = "Otomatik Güncelleme";
    const userMsg = await ask(`   ${C}│${R} Commit: `);
    finalMsg = userMsg || dftMsg;
  }
  const fullMsg = `v${nxt}: ${finalMsg}`;

  console.log(`   ${C}│${R}  ${D}${"─".repeat(W70 - 4)}${R}  ${C}│${R}`);

  menuRow(C, `${Z}1/4  git add --all...${R}`);
  if (!execOk("git add --all")) {
    execOk("git checkout -- package.json");
    menuRow(C, `${X}X  git add başarısız!${R}`);
    sectionEnd();
    return false;
  }

  menuRow(C, `${Z}2/4  git commit...${R}`);
  if (!execOk(`git commit -m "${fullMsg}"`)) {
    execOk("git checkout -- package.json");
    menuRow(C, `${X}X  Commit başarısız. Değişiklik olmayabilir.${R}`);
    sectionEnd();
    return false;
  }

  menuRow(C, `${Z}3/4  git pull --rebase origin main...${R}`);
  if (!execOk("git pull --rebase origin main")) {
    execOk("git rebase --abort");
    execOk("git checkout -- package.json");
    menuRow(C, `${X}X  Pull/Rebase başarısız. Çakışmaları manuel çöz.${R}`);
    sectionEnd();
    return false;
  }

  menuRow(C, `${Z}4/4  git push origin main...${R}`);
  if (!execOk("git push origin main")) {
    menuRow(C, `${X}X  Push başarısız. İnternet bağlantısını kontrol et.${R}`);
    sectionEnd();
    return false;
  }

  const commitHash = exec("git rev-parse --short HEAD");
  menuRow(C, "");
  menuRow(C, `${G}✓  Commit: ${W}${commitHash}${R}  ${Z}— ${G}${fullMsg}${R}`);
  sectionEnd();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            5/6  PAKETLEME VE YAYINLAMA                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function publish() {
  section("[5/6]  PAKETLEME VE YAYINLAMA");
  menuRow(C, `${Z}Çıktı: release\\MySetup-Installer.exe${R}`);
  menuRow(C, "");

  const barStr = (pct) => {
    const f = Math.floor(pct / 5);
    return `${G}█${R}`.repeat(f) + `${Z}░${R}`.repeat(20 - f);
  };

  const contentStr = (pct) => {
    const s =
      pct < 30
        ? `${M}🔧 Hazırlanıyor${R}`
        : pct < 60
          ? `${M}📦 Paketleniyor${R}`
          : `${M}☁️  Yayınlanıyor${R}`;
    return `${s} ${Z}[${barStr(pct)}]${R} ${Y}${pct}%${R}`;
  };

  const child = spawn(
    "cmd.exe",
    ["/c", "electron-builder", "--publish", "always"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    },
  );

  const buildLog = [];
  const pushLog = (chunk) => {
    const lines = chunk
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    buildLog.push(...lines);
    while (buildLog.length > 40) buildLog.shift();
  };

  child.stdout.on("data", pushLog);
  child.stderr.on("data", pushLog);

  let pct = 0;
  const anim = setInterval(() => {
    pct = Math.min(95, pct + 3);
    const c = contentStr(pct);
    const pad = Math.max(0, W70 - 2 - stripAnsi(c).length);
    process.stdout.write(`   ${C}│${R} ${c}${" ".repeat(pad)} ${C}│${R}\r`);
  }, 1200);

  const status = await new Promise((resolve) => {
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code));
  });

  clearInterval(anim);

  const ok = status === 0;
  const icon = ok ? `${G}✓${R}` : `${X}✗${R}`;
  const pctStr = ok ? "100%" : "HATA";
  const pctCol = ok ? G : X;
  const c = `${icon} ${ok ? " Yayın tamamlandı" : "Yayın başarısız"} ${Z}[${barStr(ok ? 100 : 0)}]${R} ${pctCol}${pctStr}${R}`;
  const pad = Math.max(0, W70 - 2 - stripAnsi(c).length);
  console.log(`   ${C}│${R} ${c}${" ".repeat(pad)} ${C}│${R}`);

  if (!ok) {
    menuRow(C, "");
    menuRow(C, `${X}${B}X  YAYIN HATASI${R}`);
    menuRow(C, `${Z}Olası nedenler:${R}`);
    menuRow(C, `${Z}  - GH_TOKEN yetkisiz veya süresi dolmuş${R}`);
    menuRow(C, `${Z}  - İnternet bağlantısı kesik${R}`);
    menuRow(C, `${Z}  - Yayın adı/proje bilgileri hatalı${R}`);
    if (buildLog.length) {
      menuRow(C, `${Z}Son electron-builder çıktısı:${R}`);
      buildLog.slice(-8).forEach((line) => {
        menuRow(C, `${Z}  ${line.slice(0, 60)}${R}`);
      });
    }
    sectionEnd();
    return false;
  }

  sectionEnd();
  return true;
}

async function verifyGitHubRelease(version) {
  section("[6/6]  GITHUB YAYIN DOĞRULAMA");
  const tag = `v${version}`;
  const headers = {
    Authorization: `token ${process.env.GH_TOKEN}`,
    "User-Agent": "MySetup",
    Accept: "application/vnd.github.v3+json",
  };

  try {
    const result = await httpGet(
      `https://api.github.com/repos/karmaqq/MySetup/releases/tags/${encodeURIComponent(tag)}`,
      headers,
      true,
    );

    if (result.statusCode !== 200 || !result.body) {
      error("GitHub release", `HTTP ${result.statusCode}`);
      sectionEnd();
      return false;
    }

    const release = result.body;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const assetNames = assets.map((asset) => asset.name);
    const hasInstaller = assetNames.includes("MySetup-Installer.exe");
    const hasMetadata = assetNames.some(
      (name) => name === "latest.yml" || name.endsWith(".yml"),
    );

    if (release.draft) {
      error("Release durumu", "DRAFT");
      sectionEnd();
      return false;
    }

    if (release.prerelease) {
      error("Release tipi", "PRE-RELEASE");
      sectionEnd();
      return false;
    }

    if (!hasInstaller) {
      error("Installer asset", "MySetup-Installer.exe yok");
      sectionEnd();
      return false;
    }

    if (!hasMetadata) {
      error("Update metadata", "latest.yml yok");
      sectionEnd();
      return false;
    }

    success("Release durumu", "public");
    success("Installer asset", "mevcut");
    success("Update metadata", "mevcut");
    sectionEnd();
    return true;
  } catch (e) {
    error("GitHub doğrulama", e.message || "başarısız");
    sectionEnd();
    return false;
  }
}

/* ─────────────────── Rapor ─────────────────── */

function fmtDur(s) {
  if (s < 60) return `${s.toFixed(2)} sec`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (m < 60) return `${m} min ${r} sec`;
  const h = Math.floor(m / 60);
  return `${h} hour ${m % 60} min`;
}

function report(timings, nxt) {
  const hr = "─".repeat(W70);
  const sc = (s) => `${C}${s.padStart(14)}${R}`;

  console.log(`   ┌${hr}┐`);
  menuRow(W, `  ZAMAN ÇİZELGESİ`);
  console.log(`   ├${hr}┤`);
  menuRow(W, `  Aşama                    Süre               Durum`);
  console.log(`   ├${hr}┤`);

  let total = 0;
  for (const t of timings) {
    if (t.dur < 0) continue;
    total += t.dur;
    const icon = t.ok ? "✓" : t.ok === false ? "✗" : "→";
    const sc2 = t.ok ? G : X;
    menuRow(
      W,
      `  ${t.name.padEnd(20)}  ${sc(fmtDur(t.dur))}  ${sc2}${icon}${R}`,
    );
  }

  console.log(`   ├${hr}┤`);
  const overallOk = timings.every((t) => t.ok !== false);
  const oc = overallOk ? G : X;
  menuRow(
    W,
    `  ${B}TOPLAM SÜRE${R}          ${sc(fmtDur(total))}  ${oc}${overallOk ? "✓" : "✗"}${R}`,
  );
  console.log(`   └${hr}┘`);

  console.log();
  console.log(`   ${C}${B}┌${hr}┐${R}`);
  menuRow(C, `  YAYIN BİLGİLERİ`);
  console.log(`   ${C}${B}├${hr}┤${R}`);
  menuRow(C, `${Z}Sürüm     : ${W}v${nxt}${R}`);
  menuRow(C, `${Z}Tarih     : ${W}${new Date().toLocaleString("tr-TR")}${R}`);
  console.log(`   ${C}│${R}  ${D}${"─".repeat(W70 - 4)}${R}  ${C}│${R}`);
  menuRow(C, `${Z}Depo      : ${W}https://github.com/karmaqq/MySetup${R}`);
  menuRow(
    C,
    `${Z}Release   : ${W}https://github.com/karmaqq/MySetup/releases/tag/v${nxt}${R}`,
  );

  console.log(`   ${C}├${hr}┤${R}`);
  if (overallOk) {
    menuRow(C, `${G}[OK]  YAYIN BAŞARIYLA TAMAMLANDI — v${nxt}`);
  } else {
    const failed = timings.find((t) => t.ok === false);
    let reason = "BAŞARISIZ";
    if (failed?.name === "TypeScript Derleme") reason = "DERLEME HATASI";
    else if (failed?.name === "Git İşlemleri") reason = "GİT HATASI";
    else if (failed?.name === "electron-builder") reason = "YAYIN HATASI";
    else if (failed?.name === "GitHub Doğrulama") reason = "YAYIN DOĞRULAMA HATASI";
    console.log(
      `   ${C}│${R}  ${X}│${R}                                  ${C}│${R}`,
    );
    menuRow(C, `  ${X}[XX]  İŞLEM TAMAMLANAMADI — ${reason}`);
    console.log(
      `   ${C}│${R}  ${X}│${R}                                  ${C}│${R}`,
    );
  }
  console.log(`   ${C}└${hr}┘${R}`);
}

/* ─────────────────── Ana İşlev ─────────────────── */

async function main() {
  console.log();
  boxHeader("MySetup  —  OTOMATİK YAYIN SİSTEMİ", C);
  const timings = [];

  const t0 = Date.now();
  await preflight();
  const t1 = Date.now();
  timings.push({ name: "Ön Kontroller", dur: (t1 - t0) / 1000, ok: true });

  const cur = readJson("package.json").version;

  const commitArg = process.argv[2];
  const nxt = await selectVersion(cur);
  const t2 = Date.now();
  timings.push({
    name: "Versiyon Güncelleme",
    dur: (t2 - t1) / 1000,
    ok: true,
  });

  const buildOk = await buildTs();
  const t3 = Date.now();
  timings.push({
    name: "TypeScript Derleme",
    dur: (t3 - t2) / 1000,
    ok: buildOk,
  });

  let gitOk = true,
    publishOk = true,
    verifyOk = true;
  if (!buildOk) {
    execOk("git checkout -- package.json");
    timings.push({ name: "Git İşlemleri", dur: 0, ok: null });
    timings.push({ name: "electron-builder", dur: 0, ok: null });
    timings.push({ name: "GitHub Doğrulama", dur: 0, ok: null });
  } else {
    gitOk = await gitOperations(nxt, commitArg);
    const t4 = Date.now();
    timings.push({ name: "Git İşlemleri", dur: (t4 - t3) / 1000, ok: gitOk });
    if (!gitOk) {
      timings.push({ name: "electron-builder", dur: 0, ok: null });
      timings.push({ name: "GitHub Doğrulama", dur: 0, ok: null });
    } else {
      publishOk = await publish();
      const t5 = Date.now();
      timings.push({
        name: "electron-builder",
        dur: (t5 - t4) / 1000,
        ok: publishOk,
      });
      if (!publishOk) {
        timings.push({ name: "GitHub Doğrulama", dur: 0, ok: null });
      } else {
        verifyOk = await verifyGitHubRelease(nxt);
        const t6 = Date.now();
        timings.push({
          name: "GitHub Doğrulama",
          dur: (t6 - t5) / 1000,
          ok: verifyOk,
        });
      }
    }
  }

  report(timings, nxt);
  closeRL();
}

main().catch((e) => {
  console.error(`${X}HATA:${R}`, e.message);
  closeRL();
  process.exit(1);
});
