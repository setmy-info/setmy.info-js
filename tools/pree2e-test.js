#!/usr/bin/env node

import { runWorkspaceHook } from "./workspace-hook.js";

await runWorkspaceHook("pre.e2e.js", "Preparing e2e test stage");
