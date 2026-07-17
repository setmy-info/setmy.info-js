#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { getWorkspaceInfo, resolveLocalBin } from "./workspace-utils.js";
import { escapeHtml, writePage } from "./site-utils.js";

const workspace = getWorkspaceInfo();
const eslintBin = resolveLocalBin("eslint");
const outDir = path.join(workspace.workspace, "site", "lint");

fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating lint report for ${workspace.packageName}`);

let output = "[]";

try {
  // execSync (shell-invoked) so the .cmd shim resolves correctly on Windows.
  output = execSync(`"${eslintBin}" . --format json`, {
    cwd: workspace.workspace,
    encoding: "utf8",
  });
} catch (error) {
  // eslint exits non-zero when findings exist; the report step itself
  // is informational, like Maven's checkstyle report goal.
  output = error.stdout ?? "[]";
}

const results = JSON.parse(output);
fs.writeFileSync(
  path.join(outDir, "eslint.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);

const rows = results
  .flatMap((fileResult) =>
    fileResult.messages.map((message) => ({
      file: path.relative(workspace.workspace, fileResult.filePath),
      line: message.line,
      column: message.column,
      severity: message.severity === 2 ? "error" : "warn",
      ruleId: message.ruleId ?? "",
      message: message.message,
    })),
  )
  .map(
    (row) => `<tr>
      <td>${escapeHtml(row.file)}</td>
      <td>${row.line}:${row.column}</td>
      <td class="${row.severity === "error" ? "error" : "warn"}">${row.severity}</td>
      <td>${escapeHtml(row.ruleId)}</td>
      <td>${escapeHtml(row.message)}</td>
    </tr>`,
  )
  .join("\n");

const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0);

const body = rows
  ? `<p>${errorCount} error(s), ${warningCount} warning(s)</p>
     <table>
       <thead><tr><th>File</th><th>Position</th><th>Severity</th><th>Rule</th><th>Message</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>`
  : `<p class="ok">No lint findings.</p>`;

writePage(
  path.join(outDir, "index.html"),
  `Lint report - ${workspace.packageName}`,
  body,
);

console.log(`Created ${path.join(outDir, "index.html")}`);
