#!/usr/bin/env node

import { runPhaseTests } from "./run-tests.js";

await runPhaseTests("integration");
