import { resolve } from "node:path";
import { defineConfig } from "vite";

// Default config drives `vite build --watch` (dev) and covers the desktop
// entry. The production build (npm run build) runs scripts/build.mjs, which
// builds desktop and config as separate self-contained IIFE bundles. A single
// Rollup build cannot emit multiple IIFE outputs, so each entry is built in its
// own pass. All dependencies are inlined; kintone forbids CDN script loading.
// This plugin ships no mobile bundle (see the requirements: mobile is out of
// scope because the palette relies on a physical keyboard).
export default defineConfig({
  build: {
    target: "es2019",
    outDir: "dist",
    emptyOutDir: false,
    minify: "esbuild",
    lib: {
      entry: resolve(__dirname, "src/desktop/index.ts"),
      formats: ["iife"],
      name: "kintoneCommandPaletteDesktop",
      fileName: () => "desktop.js",
    },
  },
});
