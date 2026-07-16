#!/usr/bin/env node

import fs from "node:fs";

import { getWorkspaceInfo } from "./workspace-utils.js";

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
    errors.push("source entry missing: src/index.js");
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

if (errors.length > 0) {
  console.error("");
  console.error("Validation failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("Validation successful");
