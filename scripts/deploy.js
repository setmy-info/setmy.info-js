#!/usr/bin/env node
// Deploying is installing the packed tarballs (dist/*.tgz, from `npm run package`)
// into a fresh prefix and running the deepest demo module there with SMI_PROFILES
// set to the target environment:
//
//     node scripts/deploy.js dev|test|prelive|live
//
// No real target host is wired up yet, so the installation is proven in the
// workspace: build/deploy/<env>/ gets a package.json that depends on every tarball
// and `overrides` every sibling to its tarball too (a tarball's own dependencies
// would otherwise be resolved from the registry, where these packages may not be),
// then `npm install --omit=dev`, then `demo-module-d` is imported from it - the
// artifact, not the source tree - and prints its resolved profiles and message.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const environment = process.argv[2];

if (!["dev", "test", "prelive", "live"].includes(environment)) {
    console.error("Usage: node scripts/deploy.js dev|test|prelive|live");
    process.exit(1);
}

const distDir = path.join(rootDir, "dist");
const tarballs = fs.existsSync(distDir)
    ? fs
          .readdirSync(distDir)
          .filter(
              (name) => name.startsWith("setmy-info-") && name.endsWith(".tgz"),
          )
    : [];
if (tarballs.length === 0) {
    console.error("No dist/setmy-info-*.tgz - run `npm run package` first");
    process.exit(1);
}

const specs = Object.fromEntries(
    tarballs.map((name) => {
        const [, packageName] =
            /^setmy-info-(.+)-\d+\.\d+\.\d+.*\.tgz$/.exec(name) ?? [];
        return [
            `@setmy-info/${packageName}`,
            `file:${path.join(distDir, name)}`,
        ];
    }),
);

const deployDir = path.join(rootDir, "build", "deploy", environment);
fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(deployDir, { recursive: true });
fs.writeFileSync(
    path.join(deployDir, "package.json"),
    JSON.stringify(
        {
            name: `setmy-info-deploy-${environment}`,
            private: true,
            type: "module",
            dependencies: specs,
            overrides: specs,
        },
        null,
        4,
    ) + "\n",
);

function run(command, args, extraEnv = {}) {
    const result = spawnSync(command, args, {
        cwd: deployDir,
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
        shell: process.platform === "win32",
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run(npm, [
    "install",
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
]);
run(
    process.execPath,
    [
        "--input-type=module",
        "-e",
        'const { config } = await import("@setmy-info/demo-module-d/config"); const { createMessageFromD } = await import("@setmy-info/demo-module-d"); console.log(config().profiles, createMessageFromD());',
    ],
    { SMI_PROFILES: environment },
);
console.log(
    `Installed into ${path.relative(rootDir, deployDir)} for ${environment}`,
);
