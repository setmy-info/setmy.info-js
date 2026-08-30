#!/usr/bin/env node
// The dependency documents, all from npm itself (no extra tool):
//
//     reports/security/npm-audit.json   vulnerability report - `npm audit --json`
//                                       (the OWASP dependency-check report of this row; the
//                                       GATE is `npm run audit` = npm audit --audit-level=high)
//     reports/sbom/cyclonedx.json       CycloneDX software bill of materials - `npm sbom`
//     reports/dependencies.txt          the resolved dependency tree - `npm ls --all`
//
// Everything under reports/ is archived by CI. Nothing here modifies files.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function write(relativePath, args, { allowFailure = false } = {}) {
    const target = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const result = spawnSync(npm, args, {
        cwd: rootDir,
        encoding: "utf8",
        shell: process.platform === "win32",
    });
    // npm audit exits non-zero when it finds something and npm ls when the tree
    // has problems; the document is still the point here, the gate is elsewhere.
    if (result.status !== 0 && !allowFailure) {
        process.stderr.write(result.stderr);
        throw new Error(`npm ${args.join(" ")} failed with ${result.status}`);
    }
    fs.writeFileSync(target, result.stdout);
    console.log(`Wrote ${relativePath}`);
}

write("reports/security/npm-audit.json", ["audit", "--json"], {
    allowFailure: true,
});
write("reports/sbom/cyclonedx.json", [
    "sbom",
    "--sbom-format",
    "cyclonedx",
    "--omit",
    "dev",
]);
write("reports/dependencies.txt", ["ls", "--all"], { allowFailure: true });
