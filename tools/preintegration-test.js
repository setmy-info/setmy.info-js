#!/usr/bin/env node

import { runWorkspaceHook } from "./workspace-hook.js";

await runWorkspaceHook("pre.it.js", "Preparing integration test stage");
