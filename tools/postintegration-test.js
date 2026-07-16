#!/usr/bin/env node

import { runWorkspaceHook } from "./workspace-hook.js";

await runWorkspaceHook("post.it.js", "Cleaning up integration test stage");
