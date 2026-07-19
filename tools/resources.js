#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { getWorkspaceInfo } from "./workspace-utils.js";
import {
    resolveProfileArg,
    resolveProfileProperties,
} from "./profile-utils.js";

const workspace = getWorkspaceInfo();
const resourcesDir = path.join(workspace.workspace, "resources");
const outDir = path.join(workspace.workspace, "dist", "resources");

if (!fs.existsSync(resourcesDir)) {
    console.log(
        `No resources directory for ${workspace.packageName}, skipping`,
    );
    process.exit(0);
}

let profile;

try {
    profile = resolveProfileArg(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const properties = resolveProfileProperties(profile, workspace.workspace);

fs.rmSync(outDir, { recursive: true, force: true });
copyAndFilterDirectory(resourcesDir, outDir);

console.log(
    `Filtered resources for ${workspace.packageName} with profile "${profile}" into ${outDir}`,
);

function copyAndFilterDirectory(sourceDir, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyAndFilterDirectory(sourcePath, targetPath);
            continue;
        }

        const content = fs.readFileSync(sourcePath, "utf8");

        fs.writeFileSync(targetPath, filterContent(content, entry.name));
    }
}

// Text-level ${propertyName} substitution, deliberately format-agnostic
// (same as Maven resource filtering): works unchanged whether the file is
// JSON, YAML, XML, .properties, .env, or plain text.
function filterContent(content, fileName) {
    return content.replace(/\$\{([^}]+)\}/g, (match, key) => {
        // Object.hasOwn, not `in`: `in` walks the prototype chain, so a token
        // like ${constructor} or ${toString} would "resolve" to a stringified
        // built-in function instead of being reported as unresolved.
        if (!Object.hasOwn(properties, key)) {
            console.warn(
                `Warning: ${workspace.packageName}/resources/${fileName} references ` +
                    `unresolved property "\${${key}}" for profile "${profile}"`,
            );
            return match;
        }

        return properties[key];
    });
}
