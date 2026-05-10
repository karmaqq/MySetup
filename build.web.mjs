/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          WEB BUILD (NETLIFY)                             */
/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Sadece renderer.js ve styles.css üretir — Electron modülleri hariç.     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import * as esbuild from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

async function buildWeb() {
  const start = Date.now();
  console.log("Web build starting...");

  await Promise.all([
    esbuild.build({
      entryPoints: ["src/renderer/index.ts"],
      outfile: "dist/renderer.js",
      bundle: true,
      format: "iife",
      globalName: "__mySetup",
      platform: "browser",
      target: "es2020",
      tsconfig: "tsconfig.json",
      minify: true,
      sourcemap: false,
      define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __IS_WEB__: "true",
      },
    }),
    esbuild.build({
      entryPoints: ["css/index.css"],
      outfile: "dist/styles.css",
      bundle: true,
      minify: true,
      loader: { ".woff2": "file" },
      assetNames: "[name]",
    }),
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log("Web build complete in " + elapsed + "s");
}

buildWeb().catch((e) => {
  console.error("Build error:", e);
  process.exit(1);
});
