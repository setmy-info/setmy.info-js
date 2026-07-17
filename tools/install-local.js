#!/usr/bin/env node

import { execSync } from "node:child_process";

import { getWorkspaceInfo, npmCommand, rootDir } from "./workspace-utils.js";

const workspace = getWorkspaceInfo();

console.log(`Installing ${workspace.packageName} into the workspace root`);
execSync(`${npmCommand} install --no-save "${workspace.workspace}"`, {
  cwd: rootDir,
  stdio: "inherit",
});
