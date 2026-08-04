/**
 * Build script for the Chrome extension using esbuild.
 *
 * Bundles:
 *  - background.js  (service worker, IIFE, no DOM/React)
 *  - content.js     (content script, IIFE, with React)
 *  - popup.js       (popup page, IIFE, with React)
 *  - options.js     (options page, IIFE, with React)
 *
 * Copies static assets (manifest, HTML, CSS, icons) from public/ to dist/.
 */

import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "dist");
const pub = resolve(__dirname, "public");
const src = resolve(__dirname, "src");
const core = resolve(__dirname, "..", "packages", "core", "src");

// Clean dist
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

const sharedConfig = {
  bundle: true,
  format: "iife",
  target: "es2022",
  platform: "browser",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
};

/**
 * Resolve @fve/core imports to the source TypeScript files.
 * This avoids needing to build the core package separately.
 */
const corePlugin = {
  name: "fve-core-resolve",
  setup(build) {
    build.onResolve({ filter: /^@fve\/core$/ }, () => ({
      path: resolve(core, "index.ts"),
    }));
    build.onResolve({ filter: /^@fve\/core\// }, (args) => ({
      path: resolve(core, args.path.replace("@fve/core/", "")),
    }));
  },
};

async function build() {
  // ---- Background (service worker) ----
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(src, "background", "index.ts")],
    outfile: resolve(dist, "background.js"),
    plugins: [corePlugin],
  });
  console.log("  background.js");

  // ---- Content script (with React) ----
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(src, "content", "index.tsx")],
    outfile: resolve(dist, "content.js"),
    plugins: [corePlugin],
  });
  console.log("  content.js");

  // ---- Popup (with React) ----
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(src, "popup", "Popup.tsx")],
    outfile: resolve(dist, "popup.js"),
    plugins: [corePlugin],
  });
  console.log("  popup.js");

  // ---- Options (with React) ----
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(src, "options", "Options.tsx")],
    outfile: resolve(dist, "options.js"),
    plugins: [corePlugin],
  });
  console.log("  options.js");

  // ---- Copy static assets ----
  cpSync(resolve(pub, "manifest.json"), resolve(dist, "manifest.json"));
  cpSync(resolve(pub, "popup.html"), resolve(dist, "popup.html"));
  cpSync(resolve(pub, "options.html"), resolve(dist, "options.html"));

  // Copy CSS
  const cssSrc = resolve(src, "content", "overlay.css");
  if (existsSync(cssSrc)) {
    cpSync(cssSrc, resolve(dist, "overlay.css"));
  }

  // Generate placeholder icons
  const iconsDir = resolve(dist, "icons");
  mkdirSync(iconsDir, { recursive: true });
  await generatePlaceholderIcons(iconsDir);

  console.log("\nBuild complete -> extension/dist/");
}

/**
 * Generate simple placeholder PNG icons (1x1 pixel pink squares).
 * Real icons can be added later.
 */
async function generatePlaceholderIcons(dir) {
  // Minimal valid 1x1 pink PNG
  const buf = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAH/QL+1uX5mgAAAABJRU5ErkJggg==",
    "base64",
  );
  for (const size of [16, 48, 128]) {
    writeFileSync(resolve(dir, `icon${size}.png`), buf);
  }
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
