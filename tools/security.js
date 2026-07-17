#!/usr/bin/env node

import { execSync } from "node:child_process";

import { npmCommand } from "./workspace-utils.js";

console.log("Running npm audit for workspace dependencies");
execSync(`${npmCommand} audit --omit=dev`, {
  stdio: "inherit",
});
