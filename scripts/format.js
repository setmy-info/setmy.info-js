#!/usr/bin/env node
// Sequential formatters. Each tool owns one file set. This list is the
// extension point, the same idea as scripts/lifecycle.js: a derived
// project (LESS, Angular, ...) adds its own tools next to prettier.
//
//     npm run format            write
//     npm run format:check      check only (CI)
//
// Tools run in list order. The first failing tool stops the run. In this
// template prettier is the only formatter (JS/TS/json/md).
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

export const FORMATTERS = [
    {
        name: "prettier",
        write: ["prettier", "--write", "."],
        check: ["prettier", "--check", "."],
    },
];

function resolveLocalBin(binName) {
    const suffix = process.platform === "win32" ? ".cmd" : "";

    return path.join(ROOT_DIR, "node_modules", ".bin", `${binName}${suffix}`);
}

function runFormatter(spec, mode) {
    const argv = mode === "write" ? spec.write : spec.check;
    const [binName, ...args] = argv;
    console.log(
        `${mode === "write" ? "format" : "format:check"}: ${spec.name}`,
    );
    const result = spawnSync(resolveLocalBin(binName), args, {
        cwd: ROOT_DIR,
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    return result.status ?? 1;
}

export function runFormat(mode) {
    if (mode !== "write" && mode !== "check") {
        throw new Error(`Unknown format mode "${mode}". Use write or check.`);
    }
    for (const spec of FORMATTERS) {
        const status = runFormatter(spec, mode);
        if (status !== 0) {
            return status;
        }
    }

    return 0;
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const mode = process.argv[2] === "--check" ? "check" : "write";
    process.exit(runFormat(mode));
}
