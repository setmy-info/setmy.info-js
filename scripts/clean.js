#!/usr/bin/env node
// Removes every build result: the bundles (packages/*/dist, packages/*/web/dist),
// the packed tarballs (dist/), the reports (reports/) and the running-instance /
// deploy state (build/). node_modules stays - `npm ci` is the Preparation stage's
// job; `rm -rf node_modules` when a developer wants a from-scratch checkout.
//
// Running instances are stopped first: build/servers/ holds their pid files, and
// removing those while an instance is still up would leave it orphaned on its port.
import fs from "node:fs";
import path from "node:path";

import { ROOT_DIR, stopAll } from "./servers.js";

await stopAll();

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
