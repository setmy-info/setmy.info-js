#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import {
  ensureDirectory,
  getWorkspaceInfo,
  rootDir,
  toArtifactDirectoryName,
} from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const artifactsDir = path.join(
  rootDir,
  ".artifacts",
  toArtifactDirectoryName(workspace.packageName),
);
const requestedSbom = process.argv.includes("--sbom");

ensureDirectory(artifactsDir);

if (requestedSbom) {
  const sbomPath = path.join(artifactsDir, "sbom.json");
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    metadata: {
      component: {
        name: workspace.packageName,
        version: workspace.packageJson.version,
        type: "library",
      },
    },
    components: Object.entries(workspace.packageJson.dependencies ?? {}).map(
      ([name, version]) => ({
        name,
        version,
        type: "library",
      }),
    ),
  };

  fs.writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  console.log(`Created ${sbomPath}`);
  process.exit(0);
}

execSync(`npm.cmd pack --pack-destination "${artifactsDir}"`, {
  cwd: workspace.workspace,
  stdio: "inherit",
});
