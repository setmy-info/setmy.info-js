#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { getWorkspaceInfo, resolveLocalBin } from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const jsdocBin = resolveLocalBin("jsdoc");
const srcDir = path.join(workspace.workspace, "src");
const outDir = path.join(workspace.workspace, "site", "docs");

if (!fs.existsSync(srcDir)) {
    console.log(`No src directory to document for ${workspace.packageName}`);
    process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });

console.log(`Generating API docs for ${workspace.packageName}`);
execSync(`"${jsdocBin}" "${srcDir}" --recurse --destination "${outDir}"`, {
    cwd: workspace.workspace,
    stdio: "inherit",
});

console.log(`Created ${outDir}`);
