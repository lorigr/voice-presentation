#!/usr/bin/env node
/**
 * Build script for the Chrome extension.
 * Bundles TypeScript entry points with esbuild and copies static assets to dist/.
 *
 * Usage:
 *   node build.mjs          # production build
 *   node build.mjs --watch  # watch mode
 */

import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "dist");
const src = resolve(__dirname, "src");

const watch = process.argv.includes("--watch");

// Clean dist
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(`${dist}/icons`, { recursive: true });

// TypeScript entry points
const entryPoints = [
  `${src}/background.ts`,
  `${src}/offscreen.ts`,
  `${src}/content.ts`,
  `${src}/popup.ts`,
];

const buildOptions = {
  entryPoints,
  bundle: true,
  outdir: dist,
  format: "esm",
  target: "chrome120",
  sourcemap: false,
  minify: !watch,
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length) {
    process.exit(1);
  }
  console.log("TypeScript bundles built.");
}

// Copy static assets
cpSync(`${src}/offscreen.html`, `${dist}/offscreen.html`);
cpSync(`${src}/popup.html`, `${dist}/popup.html`);
cpSync(resolve(__dirname, "manifest.json"), `${dist}/manifest.json`);
cpSync(resolve(__dirname, "icons"), `${dist}/icons`, { recursive: true });

console.log("Static assets copied.");
console.log(`\nExtension ready in: ${dist}`);
