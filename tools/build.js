#!/usr/bin/env node

import { build } from "esbuild";
import path from "node:path";

import {
  ensureDirectory,
  getWorkspaceInfo,
  removeDirectory,
} from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const banner = `/*!
 * ${workspace.packageName}
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */`;

console.log(`Building ${workspace.packageName}`);

removeDirectory(workspace.distDir);
ensureDirectory(workspace.distDir);

const commonOptions = {
  entryPoints: [workspace.srcEntry],
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node24"],
  sourcemap: true,
  banner: {
    js: banner,
  },
};

await build({
  ...commonOptions,
  minify: false,
  outfile: path.join(workspace.distDir, "index.js"),
});

await build({
  ...commonOptions,
  minify: true,
  legalComments: "none",
  outfile: path.join(workspace.distDir, "index.min.js"),
});

console.log(`Created ${path.join(workspace.distDir, "index.js")}`);
console.log(`Created ${path.join(workspace.distDir, "index.min.js")}`);
