/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          WEB BUILD (NETLIFY)                             */
/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Sadece renderer.js ve styles.css üretir — Electron modülleri hariç.     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import * as esbuild from "esbuild";
import { readFileSync } from "fs";
import { rendererBase, cssBase } from "./esbuild-config.mjs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

async function buildWeb() {
  const start = Date.now();
  console.log("Web build starting...");

  await Promise.all([
    esbuild.build({
      ...rendererBase,
      minify: true,
      sourcemap: false,
      define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __IS_WEB__: "true",
      },
    }),
    esbuild.build({
      ...cssBase,
      minify: true,
    }),
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log("Web build complete in " + elapsed + "s");
}

buildWeb().catch((e) => {
  console.error("Build error:", e);
  process.exit(1);
});
