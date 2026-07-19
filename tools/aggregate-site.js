#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { getWorkspaces, rootDir } from "./workspace-utils.js";
import { writePage } from "./site-utils.js";

const siteDir = path.join(rootDir, "site");
const workspaces = getWorkspaces();

const links = workspaces
    .filter((workspace) =>
        fs.existsSync(path.join(workspace.workspace, "site", "index.html")),
    )
    .map((workspace) => {
        const relativePath = path.relative(
            siteDir,
            path.join(workspace.workspace, "site", "index.html"),
        );

        return `<li><a href="${relativePath}">${workspace.packageName}</a></li>`;
    })
    .join("\n");

writePage(
    path.join(siteDir, "index.html"),
    "node-monorepo-demo - project site",
    `<p>Modules:</p>
   <ul>${links}</ul>`,
);

console.log(`Created ${path.join(siteDir, "index.html")}`);
