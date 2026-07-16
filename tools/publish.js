#!/usr/bin/env node

import { getWorkspaceInfo } from "./workspace-utils.js";

const workspace = getWorkspaceInfo();

console.log(`Publish placeholder for ${workspace.packageName}`);
console.log(
  "Use npm publish from the package directory when registry credentials are configured.",
);
