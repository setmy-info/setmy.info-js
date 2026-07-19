#!/usr/bin/env node

import { execSync } from "node:child_process";

import { npmCommand } from "./workspace-utils.js";

console.log("Running workspace bootstrap via npm ci");
execSync(`${npmCommand} ci`, {
    stdio: "inherit",
});
