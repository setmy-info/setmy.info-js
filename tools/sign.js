#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  ensureDirectory,
  getWorkspaceInfo,
  rootDir,
  toArtifactDirectoryName,
} from "./workspace-utils.js";

const workspace = getWorkspaceInfo();
const signatureDir = path.join(
  rootDir,
  ".signatures",
  toArtifactDirectoryName(workspace.packageName),
);

ensureDirectory(signatureDir);

for (const artifact of ["index.js", "index.min.js"]) {
  const artifactPath = path.join(workspace.distDir, artifact);

  if (!fs.existsSync(artifactPath)) {
    continue;
  }

  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(artifactPath))
    .digest("hex");
  const signaturePath = path.join(signatureDir, `${artifact}.sha256`);

  fs.writeFileSync(signaturePath, `${digest}  ${artifact}\n`);
  console.log(`Created ${signaturePath}`);
}
