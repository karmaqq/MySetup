/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ESBUILD YAPI SİSTEMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Kullanım: node build.mjs          → production build                    */
/*            node build.mjs --watch  → watch modu                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

/* ─────────────────── Renderer Bundle ─────────────────── */

const rendererConfig = {
  entryPoints: ["src/renderer/index.ts"],
  outfile: "dist/renderer.js",
  bundle: true,
  format: "iife",
  globalName: "__mySetup",
  platform: "browser",
  target: "es2020",
  tsconfig: "tsconfig.json",
  minify: !isWatch,
  sourcemap: isWatch,
};

/* ─────────────────── CSS Bundle ─────────────────── */

const cssConfig = {
  entryPoints: ["css/index.css"],
  outfile: "dist/styles.css",
  bundle: true,
  minify: !isWatch,
  loader: {
    ".woff2": "file",
  },
  assetNames: "[name]",
};

/* ─────────────────── Main Process (CJS, transpile only) ─────────────────── */

function cjsConfig(entry, out) {
  return {
    entryPoints: [entry],
    outfile: out,
    bundle: false,
    format: "cjs",
    platform: "node",
    target: "node16",
    tsconfig: "tsconfig.main.json",
    minify: false,
    sourcemap: true,
  };
}

const mainConfig = cjsConfig("src/main/main.ts", "dist/main.js");
const preloadConfig = cjsConfig("src/main/preload.ts", "dist/preload.js");
const updaterConfig = cjsConfig("src/updater/updater.ts", "dist/updater.js");

/* ─────────────────── Build / Watch ─────────────────── */

async function buildAll() {
  console.log("🔨 Building...");
  const start = Date.now();
  await Promise.all([
    esbuild.build(rendererConfig),
    esbuild.build(cssConfig),
    esbuild.build(mainConfig),
    esbuild.build(preloadConfig),
    esbuild.build(updaterConfig),
  ]);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`✅ Build complete in ${elapsed}s`);
}

async function watchAll() {
  console.log("👀 Watching for changes...");
  const ctxs = await Promise.all([
    esbuild.context(rendererConfig),
    esbuild.context(cssConfig),
    esbuild.context(mainConfig),
    esbuild.context(preloadConfig),
    esbuild.context(updaterConfig),
  ]);
  await Promise.all(ctxs.map((ctx) => ctx.watch()));
}

if (isWatch) {
  watchAll().catch((e) => {
    console.error("Watch error:", e);
    process.exit(1);
  });
} else {
  buildAll().catch((e) => {
    console.error("Build error:", e);
    process.exit(1);
  });
}
