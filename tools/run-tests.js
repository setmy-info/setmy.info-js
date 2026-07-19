#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { getWorkspaceInfo } from "./workspace-utils.js";

const phase = process.argv[2];
const cliArgs = process.argv.slice(3);

const phaseDirectoryByName = {
    unit: path.join("test", "unit"),
    integration: path.join("test", "integration"),
    e2e: path.join("test", "e2e"),
};

export function runPhaseTests(requestedPhase, extraArgs = cliArgs) {
    const workspace = getWorkspaceInfo();
    const relativePhaseDirectory = phaseDirectoryByName[requestedPhase];

    if (!relativePhaseDirectory) {
        console.error(`Unknown test phase: ${requestedPhase}`);
        process.exit(1);
    }

    const phaseDirectory = path.join(
        workspace.workspace,
        relativePhaseDirectory,
    );

    if (!fs.existsSync(phaseDirectory)) {
        console.log(
            `No ${requestedPhase} tests found for ${workspace.packageName}`,
        );
        return;
    }

    const testFiles = fs
        .readdirSync(phaseDirectory, { recursive: true, withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() &&
                (entry.name.endsWith(".test.js") ||
                    entry.name.endsWith(".test.ts")),
        )
        .map((entry) => path.join(entry.parentPath, entry.name))
        .map((filePath) => path.relative(workspace.workspace, filePath));

    if (testFiles.length === 0) {
        console.log(
            `No ${requestedPhase} test files found for ${workspace.packageName}`,
        );
        return;
    }

    console.log(`Running ${requestedPhase} tests for ${workspace.packageName}`);

    execFileSync(process.execPath, ["--test", ...extraArgs, ...testFiles], {
        cwd: workspace.workspace,
        stdio: "inherit",
    });
}

if (phase) {
    runPhaseTests(phase, cliArgs);
}
