#!/usr/bin/env node

import { build } from "esbuild";
import fs from "node:fs";
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

const webDir = path.join(workspace.workspace, "web");

if (fs.existsSync(webDir)) {
    const webDistDir = path.join(webDir, "dist");

    removeDirectory(webDistDir);
    ensureDirectory(webDistDir);

    for (const artifact of [
        "index.js",
        "index.js.map",
        "index.min.js",
        "index.min.js.map",
    ]) {
        fs.copyFileSync(
            path.join(workspace.distDir, artifact),
            path.join(webDistDir, artifact),
        );
    }

    console.log(`Published build artifacts for browser use to ${webDistDir}`);
}
