/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     MYSETUP OTOMASYONLU YAYIN SISTEMI                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { execSync, spawn, spawnSync } from "child_process";
import { createInterface } from "readline";
import { get, request } from "https";
import { join } from "path";

const R = "\x1b[0m";
const B = "\x1b[1m";
const C = "\x1b[96m";
const G = "\x1b[92m";
const Y = "\x1b[93m";
const X = "\x1b[91m";
const M = "\x1b[95m";
const W = "\x1b[97m";
const Z = "\x1b[90m";
const WIDTH = 82;
const OWNER = "karmaqq";
const REPO = "MySetup";
const INSTALLER_NAME = "MySetup-Installer.exe";

let rl = createInterface({ input: process.stdin, output: process.stdout });
let fullLog = [];
let resolvedCommitMessage = "";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const commitArg = args
  .filter((arg) => !arg.startsWith("--"))
  .join(" ")
  .trim();
const isDryRun = flags.has("--dry-run");
const skipPublish = flags.has("--skip-publish");
const autoYes = flags.has("--yes") || Boolean(commitArg);

/* ─────────────────── Genel Yardimcilar ─────────────────── */

function stripAnsi(text) {
  return String(text).replace(/\x1b\[\d+m/g, "");
}

function logLine(text = "") {
  console.log(text);
  fullLog.push(stripAnsi(text));
}

function safeCloseRl() {
  try {
    rl.close();
  } catch {
    return;
  }
}

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function exec(cmd) {
  return execSync(cmd, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
    .toString()
    .trim();
}

function execResult(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    return { ok: true, output: output.toString().trim() };
  } catch (e) {
    return {
      ok: false,
      output: `${e.stdout || ""}${e.stderr || ""}`.trim(),
    };
  }
}

function runInherited(cmd, env = {}) {
  const result = spawnSync("cmd", ["/c", cmd], {
    encoding: "utf-8",
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  return result.status === 0;
}

function gitCommit(message) {
  const result = spawnSync("git", ["commit", "-m", message], {
    encoding: "utf-8",
    stdio: "inherit",
    windowsHide: true,
  });
  return result.status === 0;
}

function httpJson(method, url, headers, body = null) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : JSON.stringify(body);
    const options = new URL(url);
    const req = request(
      {
        method,
        hostname: options.hostname,
        path: options.pathname + options.search,
        headers: {
          ...headers,
          ...(data ? { "Content-Type": "application/json" } : {}),
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode || 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function httpStatus(url, headers) {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode || 0));
    }).on("error", reject);
  });
}

function githubHeaders() {
  return {
    Authorization: `token ${process.env.GH_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "MySetup",
  };
}

function formatDuration(seconds) {
  if (seconds < 1) return `${seconds.toFixed(2)} sn`;
  if (seconds < 60) return `${seconds.toFixed(1)} sn`;
  return `${Math.floor(seconds / 60)} dk ${Math.round(seconds % 60)} sn`;
}

function boxTitle(title) {
  const line = "═".repeat(WIDTH);
  logLine(`\n${C}${B}╔${line}╗${R}`);
  logLine(`${C}${B}║ ${title.padEnd(WIDTH - 1)}║${R}`);
  logLine(`${C}${B}╚${line}╝${R}`);
}

function section(index, total, title) {
  const line = "─".repeat(WIDTH);
  logLine(`\n${C}${B}┌${line}┐${R}`);
  logLine(`${C}${B}│ [${index}/${total}] ${title.padEnd(WIDTH - 7)}│${R}`);
  logLine(`${C}${B}├${line}┤${R}`);
}

function sectionEnd() {
  const line = "─".repeat(WIDTH);
  logLine(`${C}└${line}┘${R}`);
}

function row(icon, color, label, detail = "") {
  const raw = `${icon}  ${label}${detail ? ` ${detail}` : ""}`;
  const pad = Math.max(0, WIDTH - stripAnsi(raw).length - 2);
  logLine(
    `${C}│${R} ${color}${icon}${R}  ${label}${detail ? ` ${Z}${detail}${R}` : ""}${" ".repeat(pad)} ${C}│${R}`,
  );
}

function ok(label, detail = "") {
  row("OK", G, label, detail);
}

function warn(label, detail = "") {
  row("!!", Y, label, detail);
}

function fail(label, detail = "") {
  row("XX", X, label, detail);
}

function info(label, detail = "") {
  row("..", C, label, detail);
}

function stageResult(id, name) {
  return { id, name, status: "SKIP", duration: 0, details: "" };
}

async function runStage(stages, id, total, name, fn) {
  const stage = stageResult(id, name);
  stages.push(stage);
  const start = Date.now();
  section(id, total, name);
  try {
    const result = await fn();
    stage.status = result?.status || "OK";
    stage.details = result?.details || "";
    stage.duration = (Date.now() - start) / 1000;
    sectionEnd();
    return stage.status === "OK";
  } catch (e) {
    stage.status = "FAIL";
    stage.details = e.message || "Bilinmeyen hata";
    fail("Aşama hatası", stage.details);
    stage.duration = (Date.now() - start) / 1000;
    sectionEnd();
    return false;
  }
}

/* ─────────────────── Proje Bilgisi ─────────────────── */

function loadEnvToken() {
  if (!existsSync(".env.bat")) return false;
  const envContent = readFileSync(".env.bat", "utf-8");
  const match = envContent.match(/set "GH_TOKEN=([^"]+)"/);
  if (!match || !match[1].trim()) return false;
  process.env.GH_TOKEN = match[1].trim();
  return true;
}

function getGitStatusLines() {
  const output = execResult("git status --short").output;
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function categorizeStatus(lines) {
  return lines.map((line) => {
    const code = line.slice(0, 2).trim() || "??";
    const file = line.slice(3).trim();
    let type = "Değişti";
    if (code === "??") type = "Yeni";
    else if (code.includes("D")) type = "Silindi";
    else if (code.includes("R")) type = "Taşındı";
    else if (code.includes("A")) type = "Eklendi";
    return { code, type, file };
  });
}

function nextPatchVersion(version) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Geçersiz sürüm: ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

function latestTag() {
  const result = execResult("git describe --tags --abbrev=0");
  return result.ok && result.output ? result.output : "";
}

function buildChangelog(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const result = execResult(`git log ${range} --pretty="- %s"`);
  if (!result.ok || !result.output) return "- Otomatik yayın";
  return result.output;
}

function installerManifest(version, commitHash) {
  const filePath = join("release", INSTALLER_NAME);
  if (!existsSync(filePath)) return null;
  const data = readFileSync(filePath);
  const hash = createHash("sha256").update(data).digest("hex");
  const stats = statSync(filePath);
  return {
    version,
    commit: commitHash,
    file: INSTALLER_NAME,
    size: stats.size,
    sha256: hash,
    createdAt: new Date().toISOString(),
  };
}

function writeReleaseLog(version) {
  const dir = join("release", "logs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `release-v${version}.log`);
  writeFileSync(file, fullLog.join("\n") + "\n", "utf-8");
  return file;
}

/* ─────────────────── Aşamalar ─────────────────── */

async function preflight() {
  let valid = true;
  const pkg = readJson("package.json");
  const publish = (pkg.build?.publish || []).find(
    (item) => item?.provider === "github",
  );
  const tokenLoaded = loadEnvToken();
  const branch = execResult("git branch --show-current").output;

  if (tokenLoaded) ok(".env.bat", "GH_TOKEN yüklendi");
  else {
    const msg = ".env.bat içinde GH_TOKEN bulunamadı";
    if (isDryRun || skipPublish) warn("GH_TOKEN", msg);
    else {
      fail("GH_TOKEN", msg);
      valid = false;
    }
  }

  if (branch === "main") ok("Git branch", branch);
  else {
    fail("Git branch", `${branch || "bulunamadı"}; yayın için main gerekli`);
    valid = false;
  }

  if (publish?.owner === OWNER && publish?.repo === REPO)
    ok("GitHub hedefi", `${OWNER}/${REPO}`);
  else {
    fail("GitHub hedefi", "owner/repo beklenen değer değil");
    valid = false;
  }

  if (publish?.releaseType === "release") ok("Release tipi", "release");
  else {
    fail(
      "Release tipi",
      "package.json build.publish releaseType release olmalı",
    );
    valid = false;
  }

  if ((process.env.EP_DRAFT || "").toLowerCase() === "true") {
    fail("EP_DRAFT", "true olamaz");
    valid = false;
  } else ok("EP_DRAFT", "kapalı");

  if (process.env.GH_TOKEN) {
    try {
      const code = await httpStatus(
        `https://api.github.com/repos/${OWNER}/${REPO}`,
        githubHeaders(),
      );
      if (code === 200) ok("GitHub API", "erişim başarılı");
      else if (isDryRun || skipPublish) warn("GitHub API", `HTTP ${code}`);
      else {
        fail("GitHub API", `HTTP ${code}`);
        valid = false;
      }
    } catch (e) {
      if (isDryRun || skipPublish) warn("GitHub API", e.message);
      else {
        fail("GitHub API", e.message);
        valid = false;
      }
    }
  } else if (!isDryRun && !skipPublish) {
    fail("GitHub API", "GH_TOKEN yok");
    valid = false;
  }

  if (!existsSync("node_modules"))
    warn("node_modules", "npm install gerekebilir");
  else ok("node_modules", "mevcut");

  if (!valid) throw new Error("Ön kontrol başarısız");
  return { details: "risk yok" };
}

async function reviewChanges() {
  const lines = getGitStatusLines();
  const items = categorizeStatus(lines);
  if (!items.length)
    warn("Çalışma dizini", "değişiklik yok; commit aşaması atlanabilir");
  else {
    info("Değişiklik sayısı", String(items.length));
    items.slice(0, 24).forEach((item) => {
      row(
        item.type === "Silindi" ? "--" : "++",
        item.type === "Silindi" ? X : G,
        item.type,
        item.file,
      );
    });
    if (items.length > 24)
      warn("Liste kısaltıldı", `${items.length - 24} dosya daha var`);
  }

  if (isDryRun) {
    ok("Dry-run", "git/build/publish yan etkisi yok");
    resolvedCommitMessage = commitArg || "Otomatik Güncelleme";
    return { details: `${items.length} değişiklik` };
  }

  if (autoYes) {
    resolvedCommitMessage = commitArg || "Otomatik Güncelleme";
    ok("Commit mesajı", resolvedCommitMessage);
  } else {
    const answer = String(
      await ask(
        `${C}│${R} Commit mesajı ${Z}[boş bırakırsan: Otomatik Güncelleme]${R}: `,
      ),
    ).trim();
    resolvedCommitMessage = answer || "Otomatik Güncelleme";
    ok("Commit mesajı", resolvedCommitMessage);
  }

  return { details: `${items.length} değişiklik` };
}

async function buildAndTypecheck() {
  const checks = [
    ["Renderer tip kontrol", "npx.cmd tsc --noEmit"],
    ["Main tip kontrol", "npx.cmd tsc --noEmit -p tsconfig.main.json"],
    ["Esbuild derleme", "npm.cmd run build:ts"],
  ];

  for (const [label, cmd] of checks) {
    if (isDryRun) {
      info(label, cmd);
      continue;
    }
    info(label, "çalışıyor");
    if (!runInherited(cmd)) throw new Error(`${label} başarısız`);
    ok(label, "başarılı");
  }

  return { details: isDryRun ? "dry-run" : "build temiz" };
}

async function versionCommitTag(context) {
  const pkg = readJson("package.json");
  const current = pkg.version;
  const next = nextPatchVersion(current);
  const tag = `v${next}`;
  const lastTag = latestTag();
  const changelog = buildChangelog(lastTag);
  const message = resolvedCommitMessage || "Otomatik Güncelleme";
  const fullMessage = `${tag}: ${message}`;

  context.version = next;
  context.tag = tag;
  context.changelog = changelog;
  context.lastTag = lastTag;

  info("Sürüm", `${current} -> ${next}`);
  info("Son tag", lastTag || "yok");
  info("Commit mesajı", fullMessage);

  if (isDryRun) return { details: tag };

  pkg.version = next;
  writeJson("package.json", pkg);

  if (!runInherited("git add --all")) throw new Error("git add başarısız");
  if (!gitCommit(fullMessage)) {
    throw new Error("git commit başarısız");
  }
  if (!runInherited(`git tag ${tag}`)) throw new Error("git tag başarısız");
  if (!runInherited("git pull --rebase origin main"))
    throw new Error("git pull --rebase başarısız");
  if (!runInherited("git push origin main --follow-tags"))
    throw new Error("git push başarısız");

  context.commitHash = exec("git rev-parse --short HEAD");
  ok("Commit", context.commitHash);
  ok("Tag", tag);
  return { details: tag };
}

async function packageAndPublish(context) {
  if (isDryRun) {
    info("Paketleme", "dry-run nedeniyle atlandı");
    return { details: "dry-run" };
  }

  const command = skipPublish
    ? "npx.cmd --yes electron-builder --publish never"
    : "npx.cmd --yes electron-builder --publish always";
  const logLines = [];
  info("Komut", command);

  const child = spawn("cmd", ["/c", command], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });

  child.stdout.on("data", (chunk) => collectBuildLog(chunk, logLines));
  child.stderr.on("data", (chunk) => collectBuildLog(chunk, logLines));

  const code = await new Promise((resolve) => {
    child.on("error", () => resolve(1));
    child.on("close", resolve);
  });

  logLines.forEach((line) => fullLog.push(line));
  if (code !== 0) {
    logLines
      .slice(-10)
      .forEach((line) => warn("electron-builder", line.slice(0, 68)));
    throw new Error("electron-builder başarısız");
  }

  const manifest = installerManifest(
    context.version,
    context.commitHash || exec("git rev-parse --short HEAD"),
  );
  if (manifest) {
    context.manifest = manifest;
    const path = join("release", `manifest-v${context.version}.json`);
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    ok("Manifest", path);
  } else warn("Manifest", `${INSTALLER_NAME} bulunamadı`);

  if (skipPublish) return { details: "publish atlandı" };
  return { details: "GitHub publish tamam" };
}

function collectBuildLog(chunk, logLines) {
  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  logLines.push(...lines);
  while (logLines.length > 120) logLines.shift();
}

async function verifyRelease(context) {
  if (isDryRun || skipPublish) {
    info("GitHub doğrulama", isDryRun ? "dry-run" : "skip-publish");
    return { status: "SKIP", details: isDryRun ? "dry-run" : "skip-publish" };
  }

  const result = await httpJson(
    "GET",
    `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(context.tag)}`,
    githubHeaders(),
  );
  if (result.statusCode !== 200 || !result.body)
    throw new Error(`GitHub release HTTP ${result.statusCode}`);

  const release = result.body;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const assetNames = assets.map((asset) => asset.name);
  const hasInstaller = assets.some(
    (asset) => asset.name === INSTALLER_NAME && asset.size > 0,
  );
  const hasMetadata = assets.some(
    (asset) => asset.name === "latest.yml" && asset.size > 0,
  );
  const hasBlockmap = assets.some(
    (asset) => asset.name.endsWith(".blockmap") && asset.size > 0,
  );

  if (release.draft) throw new Error("Release draft durumda");
  if (release.prerelease) throw new Error("Release prerelease durumda");
  if (!hasInstaller) throw new Error(`${INSTALLER_NAME} asset yok veya boş`);
  if (!hasMetadata) throw new Error("latest.yml asset yok veya boş");

  context.releaseUrl = release.html_url;
  context.assetNames = assetNames;
  ok("Release", release.html_url);
  ok("Installer", INSTALLER_NAME);
  ok("Metadata", "latest.yml");
  if (hasBlockmap) ok("Blockmap", "mevcut");
  else warn("Blockmap", "bulunamadı");

  if (context.changelog) {
    await httpJson("PATCH", release.url, githubHeaders(), {
      body: context.changelog,
    });
    ok("Changelog", "release gövdesine yazıldı");
  }

  return { details: release.html_url };
}

/* ─────────────────── Rapor ─────────────────── */

function renderReport(stages, context) {
  boxTitle("YAYIN RAPORU");
  const header = `${"Aşama".padEnd(24)} ${"Durum".padEnd(8)} ${"Süre".padEnd(10)} Detay`;
  logLine(`${C}${header}${R}`);
  logLine(`${Z}${"─".repeat(WIDTH)}${R}`);

  stages.forEach((stage) => {
    const color = stage.status === "OK" ? G : stage.status === "FAIL" ? X : Y;
    logLine(
      `${stage.name.padEnd(24)} ${color}${stage.status.padEnd(8)}${R} ${formatDuration(stage.duration).padEnd(10)} ${stage.details || ""}`,
    );
  });

  const failed = stages.find((stage) => stage.status === "FAIL");
  logLine(`${Z}${"─".repeat(WIDTH)}${R}`);
  if (failed)
    logLine(
      `${X}${B}İŞLEM TAMAMLANAMADI: ${failed.name} - ${failed.details}${R}`,
    );
  else logLine(`${G}${B}YAYIN AKIŞI TAMAMLANDI${R}`);

  if (context.version) logLine(`${Z}Sürüm:${R} v${context.version}`);
  if (context.commitHash) logLine(`${Z}Commit:${R} ${context.commitHash}`);
  if (context.tag) logLine(`${Z}Tag:${R} ${context.tag}`);
  if (context.releaseUrl) logLine(`${Z}Release:${R} ${context.releaseUrl}`);
  if (context.assetNames?.length)
    logLine(`${Z}Asset:${R} ${context.assetNames.join(", ")}`);
  if (context.manifest) {
    logLine(
      `${Z}Manifest:${R} ${context.manifest.file} ${context.manifest.size} byte ${context.manifest.sha256}`,
    );
  }

  if (context.version && !isDryRun) {
    const logPath = writeReleaseLog(context.version);
    logLine(`${Z}Log:${R} ${logPath}`);
  }
}

/* ─────────────────── Ana Akış ─────────────────── */

async function main() {
  const stages = [];
  const context = {};
  const total = 6;

  boxTitle("MySetup - Hibrit Yayın Otomasyonu");
  if (isDryRun) warn("Mod", "dry-run");
  if (skipPublish) warn("Mod", "skip-publish");

  const flow = [
    ["Ön Kontrol", preflight],
    ["Değişiklik Özeti", reviewChanges],
    ["Build ve Tip Kontrol", buildAndTypecheck],
    ["Versiyon Commit Tag", () => versionCommitTag(context)],
    ["Paketleme ve Yayın", () => packageAndPublish(context)],
    ["GitHub Doğrulama", () => verifyRelease(context)],
  ];

  for (let i = 0; i < flow.length; i += 1) {
    const [name, fn] = flow[i];
    const okStage = await runStage(stages, i + 1, total, name, fn);
    if (!okStage) {
      for (let j = i + 1; j < flow.length; j += 1) {
        const skipped = stageResult(j + 1, flow[j][0]);
        skipped.status = "SKIP";
        skipped.details = "önceki aşama başarısız";
        stages.push(skipped);
      }
      break;
    }
  }

  renderReport(stages, context);
  safeCloseRl();
  if (stages.some((stage) => stage.status === "FAIL")) process.exit(1);
}

main().catch((e) => {
  fail("Beklenmeyen hata", e.message);
  safeCloseRl();
  process.exit(1);
});
