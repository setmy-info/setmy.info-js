#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
    ensureDirectory,
    getWorkspaceInfo,
    rootDir,
    toArtifactDirectoryName,
} from "./workspace-utils.js";

// The only valid deploy targets: the ADR-0041 canonical environments
// something real gets deployed TO. `local` and `ci` are deliberately not
// deployable (you don't deploy to a developer machine or to the build
// environment itself), and anything else is a hard error - same rigor as
// tools/profile-utils.js applies to build profiles.
const DEPLOY_TARGETS = ["dev", "test", "prelive", "live"];
const target = process.env.DEPLOY_TARGET;

if (!target || !DEPLOY_TARGETS.includes(target)) {
    console.error(
        `Missing or invalid DEPLOY_TARGET "${target ?? ""}". Set DEPLOY_TARGET ` +
            `to one of (ADR-0041): ${DEPLOY_TARGETS.join(", ")}. ` +
            `Example: DEPLOY_TARGET=dev npm run deploy`,
    );
    process.exit(1);
}

const workspace = getWorkspaceInfo();
const deploymentDir = path.join(
    rootDir,
    ".deploy",
    toArtifactDirectoryName(workspace.packageName),
    target,
);
const descriptorPath = path.join(deploymentDir, "deploy.json");

ensureDirectory(deploymentDir);

const descriptor = {
    packageName: workspace.packageName,
    version: workspace.packageJson.version,
    target,
    generatedAt: new Date().toISOString(),
    artifacts: {
        nonMinified: "dist/index.js",
        minified: "dist/index.min.js",
    },
    deployment: {
        strategy: "copy-dist-artifacts",
        // Always "prepared-not-executed" for now: there's no real target
        // infrastructure to deploy to yet. This descriptor is what a future
        // real deploy step would consume once one exists.
        status: "prepared-not-executed",
    },
};

fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
console.log(
    `Prepared deployment descriptor for target "${target}" at ${descriptorPath}`,
);
