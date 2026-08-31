#!/usr/bin/env node
// The PROJECT-SPECIFIC side of the test lifecycle - the single point that decides
// WHAT the pre and post steps of the slower test tiers do, the shape of Maven
// failsafe's
//
//     pre-integration-test -> integration-test -> post-integration-test
//     pre-e2e-test         -> e2e-test         -> post-e2e-test
//
// From the point of view of the tiers and of CI there are only "pre" and "post":
//
//     npm run pre-integration-test            (node scripts/lifecycle.js pre-integration-test)
//     npm run integration-test
//     npm run post-integration-test
//
//     node scripts/lifecycle.js pre-integration-test pre-e2e-test
//                                             (several phases at once - around a combined run
//                                              such as `npm run coverage`; a step listed in
//                                              more than one phase runs only once)
//
// A step is an async (or plain) function, run in list order. In this template the
// integration and e2e tiers talk to the demo modules' running instances, so the
// steps start and stop them (scripts/servers.js). A project using this repo as its
// template adds what its own tiers need next to them: a database, a message
// broker, a mock of a third-party API, docker compose up/down, seeding test
// data, ... Post steps must stay idempotent - CI runs them again after a failed
// tier, and `npm run clean` runs them before removing their state.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startAll, stopAll } from "./servers.js";

export const PHASES = {
    "pre-integration-test": [startAll],
    "post-integration-test": [stopAll],

    "pre-e2e-test": [startAll],
    "post-e2e-test": [stopAll],
};

/**
 * Runs the steps of the given phases in order; a step shared by several of the
 * phases runs only once.
 * @param {string[]} phases
 */
export async function runPhases(phases) {
    const steps = [];
    for (const phase of phases) {
        if (!Object.hasOwn(PHASES, phase)) {
            throw new Error(
                `Unknown lifecycle phase "${phase}". Phases: ${Object.keys(PHASES).join(", ")}`,
            );
        }
        for (const step of PHASES[phase]) {
            if (!steps.includes(step)) {
                steps.push(step);
            }
        }
    }
    for (const step of steps) {
        await step();
    }
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    runPhases(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
