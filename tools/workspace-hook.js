import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getWorkspaceInfo } from "./workspace-utils.js";

export async function runWorkspaceHook(fileName, stageLabel) {
    const workspace = getWorkspaceInfo();
    const hookPath = path.join(workspace.workspace, fileName);

    console.log(`${stageLabel} for ${workspace.packageName}`);

    if (!fs.existsSync(hookPath)) {
        return;
    }

    const hookModule = await import(pathToFileURL(hookPath).href);

    if (typeof hookModule.default === "function") {
        await hookModule.default(workspace);
    }
}
