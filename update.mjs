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

function stripAnsi(text) {
  return String(text).replace(/\x1b\[\d+m/g, "");
}

function logLine(text = "") {
  console.log(text);
  fullLog.push(stripAnsi(text));
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
  return { id, name, status: "WAIT", duration: 0 };
}

async function runStage(stages, id, total, name, fn) {
  const stage = stageResult(id, name);
  stages.push(stage);
  const start = Date.now();
  section(id, total, name);
  try {
    const result = await fn();
    stage.status = result?.status || "OK";
    stage.duration = (Date.now() - start) / 1000;
    sectionEnd();
    return stage.status === "OK";
  } catch (e) {
    stage.status = "FAIL";
    fail("Hata", e.message);
    stage.duration = (Date.now() - start) / 1000;
    sectionEnd();
    return false;
  }
}

async function preflight() {
  let valid = true;
  if (existsSync(".env.bat")) {
    const env = readFileSync(".env.bat", "utf-8");
    const match = env.match(/set "GH_TOKEN=([^"]+)"/);
    if (match) {
      process.env.GH_TOKEN = match[1].trim();
      ok("Token", "GH_TOKEN yüklendi");
    } else {
      fail("Token", "Format hatalı");
      valid = false;
    }
  } else {
    fail(".env.bat", "Dosya bulunamadı");
    valid = false;
  }

  const branch = execResult("git branch --show-current").output;
  if (branch === "main") ok("Branch", "main");
  else {
    warn("Branch", `${branch} (Yayın için main önerilir)`);
  }
  return { status: valid ? "OK" : "FAIL" };
}

async function reviewChanges() {
  const status = execResult("git status --short").output;
  if (!status) {
    info("Durum", "Değişiklik yok");
    return { status: "OK" };
  }
  status.split("\n").forEach((l) => {
    const f = l.slice(3).trim();
    if (l.startsWith(" M")) row("MOD", Y, f);
    else if (l.startsWith("??")) row("NEW", G, f);
    else row("GIT", C, f);
  });
  return { status: "OK" };
}

async function buildAndTypecheck() {
  const bar = (pct) => {
    const f = Math.floor(pct / 5);
    return `${G}█${R}`.repeat(f) + `${Z}░${R}`.repeat(20 - f);
  };

  for (let p = 0; p <= 45; p += 5) {
    process.stdout.write(`${C}│${R} 🔨 Build [${bar(p)}] ${Y}${p}%${R}\r`);
    await new Promise((r) => setTimeout(r, 20));
  }

  const res = spawnSync("cmd", ["/c", "npm run build:ts"], {
    encoding: "utf-8",
    windowsHide: true,
  });
  if (res.status !== 0) {
    console.log();
    fail("Build", "TS Kontrolleri başarısız");
    return { status: "FAIL" };
  }

  for (let p = 50; p <= 100; p += 10) {
    process.stdout.write(`${C}│${R} ✓ Build [${bar(p)}] ${G}${p}%${R}\r`);
    await new Promise((r) => setTimeout(r, 10));
  }
  console.log();
  ok("TypeScript", "Hatasız tamamlandı");
  return { status: "OK" };
}

async function versionCommitTag(context) {
  const pkg = readJson("package.json");
  const cur = pkg.version;
  let [ma, mi, pa] = cur.split(".").map(Number);

  if (pa === 9) {
    pa = 0;
    if (mi === 9) {
      mi = 0;
      ma++;
    } else mi++;
  } else pa++;

  const nxt = `${ma}.${mi}.${pa}`;
  context.version = nxt;
  ok("Versiyon", `${W}${cur}${R} → ${G}${B}${nxt}${R}`);

  let msg = commitArg;
  if (!msg) {
    process.stdout.write(`${C}│${R} ${Y}Mesaj: ${R}`);
    msg = await ask("");
    msg = msg.trim() || "Minor update";
  }
  resolvedCommitMessage = `v${nxt}: ${msg}`;

  if (isDryRun) {
    warn("Dry Run", "İşlemler simüle edildi");
    return { status: "OK" };
  }

  pkg.version = nxt;
  writeJson("package.json", pkg);
  execSync("git add --all", { windowsHide: true });
  execSync(`git commit -m "${resolvedCommitMessage}"`, { windowsHide: true });
  execSync(`git tag -a v${nxt} -m "Release v${nxt}"`, { windowsHide: true });
  ok("Git", "Commit ve Tag tamam");
  return { status: "OK" };
}

async function packageAndPublish() {
  if (isDryRun || skipPublish) {
    warn("Skip", "Yayınlama atlandı");
    return { status: "OK" };
  }

  info("Süreç", "electron-builder başlatılıyor...");
  const proc = spawn("cmd", ["/c", "npm run publish"], {
    stdio: "inherit",
    windowsHide: true,
  });

  return new Promise((resolve) => {
    proc.on("close", (code) => {
      if (code === 0) {
        ok("Publish", "GitHub'a gönderildi");
        resolve({ status: "OK" });
      } else {
        fail("Publish", `Hata kodu: ${code}`);
        resolve({ status: "FAIL" });
      }
    });
  });
}

async function finalize(context) {
  if (isDryRun) return { status: "OK" };

  const installerPath = join("release", INSTALLER_NAME);
  if (existsSync(installerPath)) {
    const data = readFileSync(installerPath);
    const hash = createHash("sha256").update(data).digest("hex");
    const size = statSync(installerPath).size;
    context.manifest = {
      file: INSTALLER_NAME,
      size,
      hash: hash.slice(0, 16) + "...",
    };
    ok("Manifest", "SHA256 oluşturuldu");
  }

  const logDir = join("release", "logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `update-${context.version}.log`);
  writeFileSync(logFile, fullLog.join("\n"), "utf-8");
  ok("Log", logFile);

  return { status: "OK" };
}

function showSummary(stages) {
  boxTitle("İŞLEM ÖZETİ");
  stages.forEach((s) => {
    const color = s.status === "OK" ? G : s.status === "SKIP" ? Y : X;
    const dur = s.duration.toFixed(2) + "s";
    const line = `${s.id}. ${s.name.padEnd(25)} [${s.status.padEnd(4)}] (${dur.padStart(6)})`;
    logLine(
      `${C}│${R} ${color}${line}${R}${" ".repeat(WIDTH - line.length - 2)}${C}│${R}`,
    );
  });
  const line = "─".repeat(WIDTH);
  logLine(`${C}└${line}┘${R}`);
}

async function main() {
  const stages = [];
  const context = {};
  boxTitle("MySetup - Tam Otomasyonlu Güncelleme");

  const flow = [
    ["Ön Kontroller", preflight],
    ["Değişiklik İnceleme", reviewChanges],
    ["Build & Typecheck", buildAndTypecheck],
    ["Versiyon & Git", () => versionCommitTag(context)],
    ["Paketleme & Yayın", packageAndPublish],
    ["Finalizasyon", () => finalize(context)],
  ];

  for (let i = 0; i < flow.length; i++) {
    const success = await runStage(
      stages,
      i + 1,
      flow.length,
      flow[i][0],
      flow[i][1],
    );
    if (!success) {
      for (let j = i + 1; j < flow.length; j++) {
        stages.push({
          id: j + 1,
          name: flow[j][0],
          status: "SKIP",
          duration: 0,
        });
      }
      break;
    }
  }

  showSummary(stages);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
