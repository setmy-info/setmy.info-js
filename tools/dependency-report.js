#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { getWorkspaceInfo, npmCommand, rootDir } from "./workspace-utils.js";
import { escapeHtml, writePage } from "./site-utils.js";

const workspace = getWorkspaceInfo();
const outDir = path.join(workspace.workspace, "site", "dependencies");

fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating dependency tree report for ${workspace.packageName}`);

let output = "{}";

try {
    // execSync (shell-invoked) rather than execFileSync, so npmCommand
    // resolves correctly when it's "npm.cmd" on Windows.
    output = execSync(
        `${npmCommand} ls --all --json --workspace "${workspace.packageName}"`,
        { cwd: rootDir, encoding: "utf8" },
    );
} catch (error) {
    // npm ls exits non-zero on extraneous/invalid trees; the report is
    // still useful, like Maven's dependency:tree running outside of verify.
    output = error.stdout ?? "{}";
}

let tree;

try {
    tree = JSON.parse(output);
} catch {
    tree = { error: "Unable to parse npm ls output" };
}

fs.writeFileSync(
    path.join(outDir, "dependency-tree.json"),
    `${JSON.stringify(tree, null, 2)}\n`,
);

const workspaceTree = tree.dependencies?.[workspace.packageName] ?? tree;

function renderNode(name, node) {
    const version = node?.version ? `@${node.version}` : "";
    const children = Object.entries(node?.dependencies ?? {})
        .map(([childName, childNode]) => renderNode(childName, childNode))
        .join("\n");

    return `<li>${escapeHtml(name)}${escapeHtml(version)}${
        children ? `<ul>${children}</ul>` : ""
    }</li>`;
}

const rootEntries = Object.entries(workspaceTree.dependencies ?? {})
    .map(([name, node]) => renderNode(name, node))
    .join("\n");

const body = rootEntries
    ? `<ul>${rootEntries}</ul>
     <p><a href="./dependency-tree.json">Raw npm ls --all --json output</a></p>`
    : `<p>No resolved dependencies.</p>`;

writePage(
    path.join(outDir, "index.html"),
    `Dependency tree - ${workspace.packageName}`,
    body,
);

console.log(`Created ${path.join(outDir, "index.html")}`);
