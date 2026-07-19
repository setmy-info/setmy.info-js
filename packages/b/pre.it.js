import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const serverToolPath = path.join(
    workspaceDir,
    "..",
    "..",
    "tools",
    "http-server.js",
);

execFileSync(
    process.execPath,
    [serverToolPath, "start", "--port", "43232", "--directory", "web"],
    {
        cwd: workspaceDir,
        stdio: "inherit",
    },
);
