#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  ensureDirectory,
  getWorkspaceInfo,
  rootDir,
  toArtifactDirectoryName,
} from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const deploymentDir = path.join(
  rootDir,
  ".deploy",
  toArtifactDirectoryName(workspace.packageName),
);
const descriptorPath = path.join(deploymentDir, "deploy.json");

ensureDirectory(deploymentDir);

const descriptor = {
  packageName: workspace.packageName,
  version: workspace.packageJson.version,
  generatedAt: new Date().toISOString(),
  artifacts: {
    nonMinified: "dist/index.js",
    minified: "dist/index.min.js",
  },
  deployment: {
    strategy: "copy-dist-artifacts",
    status: "prepared-not-executed",
  },
};

fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
console.log(`Prepared deployment descriptor at ${descriptorPath}`);
