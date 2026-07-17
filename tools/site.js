#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { getWorkspaceInfo, rootDir } from "./workspace-utils.js";
import { writePage } from "./site-utils.js";

const workspace = getWorkspaceInfo();
const siteDir = path.join(workspace.workspace, "site");
const reportTools = [
  ["docs.js", "API docs (JSDoc)", "docs/index.html"],
  ["lint-report.js", "Lint report (ESLint)", "lint/index.html"],
  ["coverage-report.js", "Coverage report", "coverage/index.html"],
  ["security-report.js", "Security report (npm audit)", "security/index.html"],
  [
    "dependency-report.js",
    "Dependency tree (npm ls)",
    "dependencies/index.html",
  ],
];

console.log(`Generating site for ${workspace.packageName}`);

const links = [];

for (const [tool, label, relativeReportPath] of reportTools) {
  execFileSync(process.execPath, [path.join(rootDir, "tools", tool)], {
    cwd: workspace.workspace,
    stdio: "inherit",
  });

  if (fs.existsSync(path.join(siteDir, relativeReportPath))) {
    links.push(`<li><a href="./${relativeReportPath}">${label}</a></li>`);
  }
}

const sbomPath = path.join(
  rootDir,
  ".artifacts",
  workspace.packageName.replace(/^@/, "").replace(/\//g, "-"),
  "sbom.json",
);

if (fs.existsSync(sbomPath)) {
  links.push(`<li><a href="${path.relative(siteDir, sbomPath)}">SBOM</a></li>`);
}

writePage(
  path.join(siteDir, "index.html"),
  `${workspace.packageName} - project site`,
  `<p>Version ${workspace.packageJson.version}</p>
   <ul>${links.join("\n")}</ul>`,
);

console.log(`Created ${path.join(siteDir, "index.html")}`);
