#!/usr/bin/env node

import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { removeDirectory, rootDir } from "./workspace-utils.js";

// Root half of the Clean phase (the per-module half is tools/clean.js via
// run-workspaces). Maven's `clean` removes target/ - every generated thing -
// and a `mvn clean verify` always works from a dirty state. The root-level
// generated directories and, above all, the test-server registrations in
// .artifacts/http-servers/ were never cleaned before, so an interrupted run
// left leaked servers that made the next pre-integration-test fail with
// "already registered" (report.md item 46).

const httpServerTool = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "http-server.js",
);

console.log("Stopping any registered test HTTP servers");
execFileSync(process.execPath, [httpServerTool, "stop-all"], {
    cwd: rootDir,
    stdio: "inherit",
});

for (const target of [".artifacts", ".deploy", ".signatures", "site"]) {
    const dir = path.join(rootDir, target);
    removeDirectory(dir);
    console.log(`Removed ${dir}`);
}

console.log("Root clean completed");
