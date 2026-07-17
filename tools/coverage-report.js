#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { getWorkspaceInfo } from "./workspace-utils.js";
import { runPhaseTests } from "./run-tests.js";
import { escapeHtml, parseLcov, writePage } from "./site-utils.js";

const workspace = getWorkspaceInfo();
const outDir = path.join(workspace.workspace, "site", "coverage");
const lcovPath = path.join(outDir, "lcov.info");

fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating coverage report for ${workspace.packageName}`);

runPhaseTests("unit", [
  "--experimental-test-coverage",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=lcov",
  `--test-reporter-destination=${lcovPath}`,
]);

const files = fs.existsSync(lcovPath)
  ? parseLcov(fs.readFileSync(lcovPath, "utf8"))
  : [];

const rows = files
  .map((file) => {
    const percent = file.linesFound
      ? ((file.linesHit / file.linesFound) * 100).toFixed(2)
      : "0.00";

    return `<tr>
      <td>${escapeHtml(file.file)}</td>
      <td>${percent}%</td>
      <td>${file.linesHit}/${file.linesFound}</td>
    </tr>`;
  })
  .join("\n");

const body = rows
  ? `<table>
       <thead><tr><th>File</th><th>Line coverage</th><th>Lines hit/found</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <p><a href="./lcov.info">Raw lcov.info</a></p>`
  : `<p>No coverage data collected.</p>`;

writePage(
  path.join(outDir, "index.html"),
  `Coverage report - ${workspace.packageName}`,
  body,
);

console.log(`Created ${path.join(outDir, "index.html")}`);
