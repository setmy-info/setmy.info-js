#!/usr/bin/env node

import path from "node:path";

import { getWorkspaceInfo, removeDirectory } from "./workspace-utils.js";

// Everything a module's lifecycle generates (Maven `clean` removes target/,
// i.e. every generated thing): build output, the site reports and the
// browser copy of the build (report.md item 46).
const targets = [
    "target",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".tmp",
    "site",
    path.join("web", "dist"),
];

const workspace = getWorkspaceInfo();

console.log(`Cleaning workspace: ${workspace.packageName}`);
console.log(`Location: ${workspace.workspace}`);

for (const target of targets) {
    const dir = path.join(workspace.workspace, target);
    removeDirectory(dir);
    console.log(`Removed ${dir}`);
}

console.log("Clean completed");
