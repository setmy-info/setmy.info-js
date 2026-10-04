#!/usr/bin/env node
// One test tier with Node's own test runner (node --test), kept strictly apart by
// directory - packages/*/test/<tier>/ - and run one tier at a time:
//
//     npm test                    unit
//     npm run integration-test    integration
//     npm run e2e-test            e2e (Selenium specs: an external Selenium Grid, scripts/pageHelper.js)
//     npm run coverage            all three tiers in one run, under coverage (reports/coverage/lcov.info)
//
// Every run also writes JUnit XML to reports/junit/<tier>.xml - what Jenkins' junit
// step reads - next to the spec output on stdout.
//
// This runner only runs tests. What the integration and e2e tiers need around them
// (in this template: the demo modules' running instances) is the lifecycle's job -
// bracket the tier with its pre and post phases, defined in scripts/lifecycle.js:
//
//     npm run pre-e2e-test
//     npm run e2e-test
//     npm run post-e2e-test       # idempotent - run it after a failed tier too
//
// and `npm run coverage` with both tiers' phases around it (shared steps run once):
//
//     node scripts/lifecycle.js pre-integration-test pre-e2e-test
//     npm run coverage
//     node scripts/lifecycle.js post-integration-test post-e2e-test
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const TIERS = ["unit", "integration", "e2e"];
const tier = process.argv[2];

if (!tier || (tier !== "coverage" && !TIERS.includes(tier))) {
    console.error("Usage: node scripts/test.js unit|integration|e2e|coverage");
    process.exit(1);
}

const tiers = tier === "coverage" ? TIERS : [tier];
// Package tests, the repository tooling's own tests (scripts/test/<tier>/),
// and the e2e tier's Selenium specs: <page>.e2e.js / <page>.gherkin.e2e.js
// (the setmy-info-less naming, scripts/pageHelper.js).
const patterns = tiers.flatMap((name) => [
    `packages/*/test/${name}/**/*.test.{js,ts}`,
    `scripts/test/${name}/**/*.test.js`,
    ...(name === "e2e" ? ["packages/*/test/e2e/**/*.e2e.js"] : []),
]);
const reportsDir = path.join(ROOT_DIR, "reports");
fs.mkdirSync(path.join(reportsDir, "junit"), { recursive: true });

const args = [
    "--test",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=junit",
    `--test-reporter-destination=${path.join(reportsDir, "junit", `${tier}.xml`)}`,
];

// One browser at a time: every e2e spec file opens its own Selenium session,
// and parallel files would compete for the grid's session slots (jest
// --maxWorkers=1 in setmy-info-less).
if (tiers.includes("e2e")) {
    args.push("--test-concurrency=1");
}

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

const { status } = spawnSync(process.execPath, [...args, ...patterns], {
    cwd: ROOT_DIR,
    stdio: "inherit",
});

process.exit(status ?? 1);
