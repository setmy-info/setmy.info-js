#!/usr/bin/env node

import path from "node:path";
import { execSync } from "node:child_process";

import {
  getWorkspaces,
  npmCommand,
  rootDir,
  sortWorkspacesTopologically,
} from "./workspace-utils.js";

const lifecycle = process.argv[2];

if (!lifecycle) {
  console.error("Usage: node ./tools/run-workspaces.js <lifecycle>");
  process.exit(1);
}

const forwardArgs = process.argv.slice(3);
const workspaces = sortWorkspacesTopologically(getWorkspaces());
const reverseLifecycles = new Set(["clean"]);
const orderedWorkspaces = reverseLifecycles.has(lifecycle)
  ? [...workspaces].reverse()
  : workspaces;

for (const workspace of orderedWorkspaces) {
  const script = workspace.packageJson.scripts?.[lifecycle];

  if (!script) {
    continue;
  }

  console.log(`\n=== ${workspace.packageName}: ${lifecycle} ===`);

  const args = ["run", lifecycle];

  if (forwardArgs.length > 0) {
    args.push("--", ...forwardArgs);
  }

  execSync(`${npmCommand} ${args.join(" ")}`, {
    cwd: workspace.workspace,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_local_prefix: workspace.workspace,
    },
  });
}

if (orderedWorkspaces.length === 0) {
  console.warn(
    `No workspace packages found under ${path.relative(process.cwd(), rootDir)}.`,
  );
}
