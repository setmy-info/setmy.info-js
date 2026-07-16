#!/usr/bin/env node

import { runWorkspaceHook } from "./workspace-hook.js";

await runWorkspaceHook("post.e2e.js", "Cleaning up e2e test stage");
