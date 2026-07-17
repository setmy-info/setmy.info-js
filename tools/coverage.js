#!/usr/bin/env node

import { execSync } from "node:child_process";

import { npmCommand } from "./workspace-utils.js";

console.log("Running Node test coverage");
execSync(`${npmCommand} run test -- --experimental-test-coverage`, {
  stdio: "inherit",
});
