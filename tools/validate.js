#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { getWorkspaceInfo, resolveLocalBin } from "./workspace-utils.js";

const workspace = getWorkspaceInfo();

console.log(`Validating workspace: ${workspace.packageName}`);
console.log(`Location: ${workspace.workspace}`);

let errors = [];

if (!fs.existsSync(workspace.packageJsonPath)) {
  errors.push("package.json missing");
} else {
  const pkg = workspace.packageJson;

  if (!pkg.name) {
    errors.push("package.json: name missing");
  }

  if (!pkg.version) {
    errors.push("package.json: version missing");
  }

  if (!fs.existsSync(workspace.srcEntry)) {
    errors.push(
      `source entry missing: ${path.relative(workspace.workspace, workspace.srcEntry)}`,
    );
  }

  if (pkg.main !== "./dist/index.js") {
    errors.push("package.json: main must point to ./dist/index.js");
  }

  if (!pkg.exports?.["./min"]) {
    errors.push("package.json: ./min export missing");
  }
}

if (!process.version) {
  errors.push("Node.js version unavailable");
}

// TypeScript is opt-in per module (see workspace-utils.js resolveSrcEntry):
// a module only gets type-checked if it has its own tsconfig.json. esbuild
// (build.js) only strips types, it never type-checks, so this is the one
// place that actually catches a type error - the Maven-compile-phase
// equivalent for a TS module.
const tsconfigPath = path.join(workspace.workspace, "tsconfig.json");

if (fs.existsSync(tsconfigPath)) {
  const tscBin = resolveLocalBin("tsc");

  try {
    execSync(`"${tscBin}" --noEmit -p "${tsconfigPath}"`, {
      cwd: workspace.workspace,
      stdio: "inherit",
    });
  } catch {
    errors.push("TypeScript type-check failed (see tsc output above)");
  }
}

if (errors.length > 0) {
  console.error("");
  console.error("Validation failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("Validation successful");
