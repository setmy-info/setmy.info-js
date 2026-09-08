#!/usr/bin/env node
// Publish every workspace, the Maven way: two deployables, decided by the branch.
//
//     devel.*  -> the -SNAPSHOT version, dist-tag "snapshot", to NPM_SNAPSHOT_REGISTRY
//     master   -> the release version (no -SNAPSHOT), dist-tag "latest", to NPM_RELEASE_REGISTRY
//
// A version that does not match its branch is refused: master never publishes a
// SNAPSHOT, develop never publishes a release. A registry that is not configured
// turns the run into a dry run, so a machine without the registries can never
// publish by accident. NPM_TOKEN goes through .npmrc.publish. A version that is
// already on the registry is reported and is not a build failure - bump the
// version to release a new one.
//
// Publish order is the root package.json `workspaces` order, which is kept in
// dependency order (commons first): a package must exist on the registry before
// its dependents. `npm publish` would re-invoke this script (the "publish"
// lifecycle hook shares the name), so each package is published with
// --ignore-scripts. The packages are scoped, so --access public.
import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

export function resolvePublishTarget(branchName, version) {
    const snapshot = /-SNAPSHOT$/.test(version);
    if (branchName === "master") {
        if (snapshot) {
            throw new Error(
                `master publishes releases - remove -SNAPSHOT from the version (${version})`,
            );
        }
        return { tag: "latest", registryEnv: "NPM_RELEASE_REGISTRY" };
    }
    if (/^devel/.test(branchName)) {
        if (!snapshot) {
            throw new Error(
                `${branchName} publishes snapshots - the version must end in -SNAPSHOT (${version})`,
            );
        }
        return { tag: "snapshot", registryEnv: "NPM_SNAPSHOT_REGISTRY" };
    }
    return null;
}

export function resolveBranch() {
    if (process.env.BRANCH_NAME) {
        return process.env.BRANCH_NAME;
    }
    if (process.env.CI_BRANCH_NAME) {
        return process.env.CI_BRANCH_NAME;
    }
    try {
        return execSync("git rev-parse --abbrev-ref HEAD", {
            cwd: rootDir,
            encoding: "utf8",
        }).trim();
    } catch {
        return "unknown";
    }
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function workspaces() {
    return readJson(path.join(rootDir, "package.json")).workspaces.map(
        (dir) => ({
            dir: path.join(rootDir, dir),
            packageJson: readJson(path.join(rootDir, dir, "package.json")),
        }),
    );
}

function publishWorkspace(workspace, target, registry, execute) {
    const { name, version } = workspace.packageJson;
    if (workspace.packageJson.private) {
        console.log(`Skipping ${name}: private`);
        return;
    }
    const args = [
        "publish",
        "--access",
        "public",
        "--tag",
        target.tag,
        "--ignore-scripts",
    ];
    if (registry) {
        args.push("--registry", registry);
    }
    if (!execute) {
        args.push("--dry-run");
    }
    console.log(
        `${execute ? "Publishing" : "Dry-run publishing"} ${name}@${version} to dist-tag "${target.tag}"${registry ? ` at ${registry}` : ""}`,
    );
    const result = spawnSync(npm, args, {
        cwd: workspace.dir,
        encoding: "utf8",
        shell: process.platform === "win32",
    });
    const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
    if (result.status === 0) {
        process.stdout.write(result.stdout ?? "");
        return;
    }
    if (output.includes("cannot publish over")) {
        console.log(
            `Skipping ${name}@${version}: this version is already published — bump the version to release a new one.`,
        );
        return;
    }
    process.stderr.write(output);
    process.exit(result.status ?? 1);
}

function main() {
    const branch = resolveBranch();
    const version = readJson(path.join(rootDir, "package.json")).version;
    let target;
    try {
        target = resolvePublishTarget(branch, version);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
    if (!target) {
        console.log(
            `Skipping publish: branch "${branch}" is not a publish branch (devel.* or master).`,
        );
        return;
    }
    const registry = process.env[target.registryEnv];
    if (!registry) {
        console.log(
            `${target.registryEnv} is not set - dry run against the default registry.`,
        );
    }
    const execute =
        Boolean(registry) &&
        (process.env.PUBLISH_EXECUTE === "true" ||
            Boolean(process.env.NPM_TOKEN));
    for (const workspace of workspaces()) {
        publishWorkspace(workspace, target, registry, execute);
    }
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main();
}
