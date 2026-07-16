#!/usr/bin/env node

import { execSync } from "node:child_process";

console.log("Running Node test coverage");
execSync("npm.cmd run test -- --experimental-test-coverage", {
  stdio: "inherit",
});
