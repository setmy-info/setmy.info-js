#!/usr/bin/env node
// One test tier with Node's own test runner (node --test), kept strictly apart by
// directory - packages/*/test/<tier>/ - and run one tier at a time:
//
//     npm test                    unit
//     npm run integration-test    integration
//     npm run e2e-test            e2e
//     npm run coverage            all three tiers in one run, under coverage (reports/coverage/lcov.info)
//
// Every run also writes JUnit XML to reports/junit/<tier>.xml - what Jenkins' junit
// step reads - next to the spec output on stdout.
//
// The integration and e2e tiers (and coverage) need the demo modules' instances
// running. When `npm run server:start` already started them (CI does, as its own
// pre step) they are used as they are and left running for the post step; when
// nothing is running - a developer typing `npm run e2e-test` - they are started
// before and always stopped after, whatever the tests did.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ROOT_DIR, running, startAll, stopAll } from "./servers.js";

const TIERS = ["unit", "integration", "e2e"];
const tier = process.argv[2];

if (!tier || (tier !== "coverage" && !TIERS.includes(tier))) {
    console.error("Usage: node scripts/test.js unit|integration|e2e|coverage");
    process.exit(1);
}

const tiers = tier === "coverage" ? TIERS : [tier];
const patterns = tiers.map(
    (name) => `packages/*/test/${name}/**/*.test.{js,ts}`,
);
const reportsDir = path.join(ROOT_DIR, "reports");
fs.mkdirSync(path.join(reportsDir, "junit"), { recursive: true });

const args = [
    "--test",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=junit",
    `--test-reporter-destination=${path.join(reportsDir, "junit", `${tier}.xml`)}`,
];

if (tier === "coverage") {
    fs.mkdirSync(path.join(reportsDir, "coverage"), { recursive: true });
    args.push(
        "--experimental-test-coverage",
        "--test-coverage-include=packages/*/src/**",
        // The instances the e2e tier requests against are separate processes,
        // outside the measured test process; the CLI is exercised the same way.
        "--test-coverage-exclude=packages/*/src/server.*",
        "--test-coverage-exclude=packages/*/src/cli.js",
        "--test-coverage-exclude=**/*.d.ts",
        "--test-coverage-lines=90",
        "--test-reporter=lcov",
        `--test-reporter-destination=${path.join(reportsDir, "coverage", "lcov.info")}`,
    );
}

const needsServers = tier !== "unit";
const manageServers = needsServers && !running();

if (manageServers) {
    await startAll();
}

let status;
try {
    ({ status } = spawnSync(process.execPath, [...args, ...patterns], {
        cwd: ROOT_DIR,
        stdio: "inherit",
    }));
} finally {
    if (manageServers) {
        await stopAll();
    }
}

process.exit(status ?? 1);
