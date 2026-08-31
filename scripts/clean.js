#!/usr/bin/env node
// Removes every build result: the bundles (packages/*/dist, packages/*/web/dist),
// the packed tarballs (dist/), the reports (reports/) and the running-instance /
// deploy state (build/). node_modules stays - `npm ci` is the Preparation stage's
// job; `rm -rf node_modules` when a developer wants a from-scratch checkout.
//
// The lifecycle's post phases run first: build/ holds their state (in this
// template the instances' pid files), and removing that from under something
// still running would leave it orphaned - an instance nothing can stop anymore.
import fs from "node:fs";
import path from "node:path";

import { runPhases } from "./lifecycle.js";
import { ROOT_DIR } from "./servers.js";

await runPhases(["post-integration-test", "post-e2e-test"]);

const packagesDir = path.join(ROOT_DIR, "packages");
const targets = ["dist", "reports", "build", "coverage"].map((name) =>
    path.join(ROOT_DIR, name),
);
for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
        const packageDir = path.join(packagesDir, entry.name);
        targets.push(
            path.join(packageDir, "dist"),
            path.join(packageDir, "web", "dist"),
        );
    }
}

for (const target of targets) {
    if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`Removed ${path.relative(ROOT_DIR, target)}`);
    }
}
