#!/usr/bin/env node

import { execSync } from "node:child_process";

console.log("Running workspace bootstrap via npm ci");
execSync("npm.cmd ci", {
  stdio: "inherit",
});
