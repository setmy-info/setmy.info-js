#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

import {
    getWorkspaceInfo,
    getWorkspaces,
    npmCommand,
    rootDir,
    toArtifactDirectoryName,
} from "./workspace-utils.js";

// Repurposed per report.md items 11/20/35 (decided 2026-07-19), ported from
// the Python/Elixir sides' worked implementations: install the *packed*
// tarball (Package's actual output, not the workspace link) into a
// disposable temp project and confirm it imports. Catches broken
// `files`/`exports` lists an npm-workspaces link silently masks, since the
// link points straight at the workspace directory and never exercises the
// tarball's own file-inclusion rules.

const workspace = getWorkspaceInfo();

function packedTarball(packageName) {
    const artifactsDir = path.join(
        rootDir,
        ".artifacts",
        toArtifactDirectoryName(packageName),
    );

    if (!fs.existsSync(artifactsDir)) {
        return undefined;
    }

    const tarball = fs
        .readdirSync(artifactsDir)
        .find((entry) => entry.endsWith(".tgz"));

    return tarball ? path.join(artifactsDir, tarball) : undefined;
}

// The module's own tarball plus every transitive local-dependency tarball,
// so a module like `d` (needs `c`, which needs `a` and `b`) resolves its
// whole local chain from packed files, never from the registry — the same
// transitive walk the Python side needed for exactly the same reason (its
// module-`c` install failed against PyPI before that fix, see
// setmy.info-python/report.md item 4).
const workspacesByName = new Map(
    getWorkspaces().map((entry) => [entry.packageName, entry]),
);

function collectLocalChain(packageName, collected = new Set()) {
    if (collected.has(packageName)) {
        return collected;
    }

    collected.add(packageName);

    for (const dependency of workspacesByName.get(packageName)
        ?.localDependencies ?? []) {
        collectLocalChain(dependency, collected);
    }

    return collected;
}

const tarballs = [...collectLocalChain(workspace.packageName)].map((name) => {
    const tarball = packedTarball(name);

    if (!tarball) {
        console.error(
            `No packed tarball found for ${name} — run the package phase first (npm run package)`,
        );
        process.exit(1);
    }

    return tarball;
});

const checkDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-install-check-"));

try {
    fs.writeFileSync(
        path.join(checkDir, "package.json"),
        `${JSON.stringify(
            { name: "install-check", version: "0.0.0", private: true },
            null,
            2,
        )}\n`,
    );

    console.log(
        `Installing packed ${workspace.packageName} (+ ${tarballs.length - 1} local dependency tarball(s)) into a throwaway project`,
    );

    // One combined install: npm satisfies the module's exact-pinned local
    // dependencies from the sibling tarballs installed alongside it instead
    // of asking the registry. --ignore-scripts: same rule as publish (§10).
    execSync(
        `${npmCommand} install --ignore-scripts ${tarballs
            .map((tarball) => `"${tarball}"`)
            .join(" ")}`,
        { cwd: checkDir, stdio: "inherit" },
    );

    execSync(
        `"${process.execPath}" --input-type=module -e "await import('${workspace.packageName}'); console.log('${workspace.packageName} imports cleanly from its packed tarball');"`,
        { cwd: checkDir, stdio: "inherit" },
    );
} finally {
    fs.rmSync(checkDir, { recursive: true, force: true });
}
