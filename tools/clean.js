#!/usr/bin/env node

import path from "node:path";

import { getWorkspaceInfo, removeDirectory } from "./workspace-utils.js";

const targets = ["target", "dist", "build", "coverage", ".cache", ".tmp"];

const workspace = getWorkspaceInfo();

console.log(`Cleaning workspace: ${workspace.packageName}`);
console.log(`Location: ${workspace.workspace}`);

for (const target of targets) {
  const dir = path.join(workspace.workspace, target);
  removeDirectory(dir);
  console.log(`Removed ${dir}`);
}

console.log("Clean completed");
