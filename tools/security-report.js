#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { getWorkspaceInfo, npmCommand, rootDir } from "./workspace-utils.js";
import { escapeHtml, writePage } from "./site-utils.js";

const workspace = getWorkspaceInfo();
const outDir = path.join(workspace.workspace, "site", "security");

fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating security report for ${workspace.packageName}`);

let output = "{}";

try {
    // execSync (shell-invoked) rather than execFileSync, so npmCommand
    // resolves correctly when it's "npm.cmd" on Windows. No --omit=dev: the
    // report must show the same scope the Security phase's gate (`npm audit`
    // at the root, dev deps included, matching the Python/Elixir sides'
    // audit-everything policy) actually checks.
    output = execSync(`${npmCommand} audit --json`, {
        cwd: rootDir,
        encoding: "utf8",
    });
} catch (error) {
    // npm audit exits non-zero when vulnerabilities are found; the report
    // step itself is informational, like Maven's dependency-check report goal.
    output = error.stdout ?? "{}";
}

let report;

try {
    report = JSON.parse(output);
} catch {
    report = { error: "Unable to parse npm audit output" };
}

fs.writeFileSync(
    path.join(outDir, "audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
);

const vulnerabilities = Object.values(report.vulnerabilities ?? {});
const rows = vulnerabilities
    .map(
        (vulnerability) => `<tr>
      <td>${escapeHtml(vulnerability.name)}</td>
      <td class="${vulnerability.severity === "low" ? "warn" : "error"}">${escapeHtml(vulnerability.severity)}</td>
      <td>${escapeHtml(vulnerability.range)}</td>
      <td>${vulnerability.fixAvailable ? "yes" : "no"}</td>
    </tr>`,
    )
    .join("\n");

const body = rows
    ? `<table>
       <thead><tr><th>Package</th><th>Severity</th><th>Range</th><th>Fix available</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>`
    : `<p class="ok">No known vulnerabilities.</p>`;

writePage(
    path.join(outDir, "index.html"),
    `Security report - ${workspace.packageName}`,
    body,
);

console.log(`Created ${path.join(outDir, "index.html")}`);
