/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ESBUILD ORTAK YAPILANDIRMA                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const rendererBase = {
  entryPoints: ["src/renderer/index.ts"],
  outfile: "dist/renderer.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  tsconfig: "tsconfig.json",
};

export const cssBase = {
  entryPoints: ["css/index.css"],
  outfile: "dist/styles.css",
  bundle: true,
  loader: { ".woff2": "file" },
  assetNames: "[name]",
};
