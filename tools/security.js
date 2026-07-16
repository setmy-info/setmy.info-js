#!/usr/bin/env node

import { execSync } from "node:child_process";

console.log("Running npm audit for workspace dependencies");
execSync("npm.cmd audit --omit=dev", {
  stdio: "inherit",
});
