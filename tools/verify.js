#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { getWorkspaceInfo } from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const requiredArtifacts = [
    path.join(workspace.distDir, "index.js"),
    path.join(workspace.distDir, "index.min.js"),
];

for (const artifact of requiredArtifacts) {
    if (!fs.existsSync(artifact)) {
        console.error(`Missing build artifact: ${artifact}`);
        process.exit(1);
    }
}

console.log(`Verified build artifacts for ${workspace.packageName}`);
