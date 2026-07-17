import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..");
export const packagesDir = path.join(rootDir, "packages");
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export function resolveLocalBin(binName) {
  const suffix = process.platform === "win32" ? ".cmd" : "";

  return path.join(rootDir, "node_modules", ".bin", `${binName}${suffix}`);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getWorkspaceInfo(workspace = process.cwd()) {
  const packageJsonPath = path.join(workspace, "package.json");
  const pkg = readJson(packageJsonPath);

  return {
    workspace,
    packageJsonPath,
    packageName: pkg.name,
    packageJson: pkg,
    srcEntry: resolveSrcEntry(workspace),
    distDir: path.join(workspace, "dist"),
  };
}

// TypeScript is opt-in per module: if src/index.ts exists, use it; JS
// modules (the default) are unaffected. esbuild transpiles either
// unchanged in build.js; validate.js/run-tests.js pick up whichever
// extension resolveSrcEntry finds.
function resolveSrcEntry(workspace) {
  const tsEntry = path.join(workspace, "src", "index.ts");

  return fs.existsSync(tsEntry)
    ? tsEntry
    : path.join(workspace, "src", "index.js");
}

export function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function removeDirectory(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export function getWorkspaces() {
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  const infos = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name))
    .filter((workspacePath) =>
      fs.existsSync(path.join(workspacePath, "package.json")),
    )
    .map((workspacePath) => getWorkspaceInfo(workspacePath));

  // A dependency is "local" iff it names another workspace in this repo -
  // detected against the actual workspace package names, NOT a hard-coded
  // scope prefix, so real (non-@demo) packages moved into this skeleton
  // keep their topological build order without touching this file.
  // devDependencies/peerDependencies count too: a module that needs a
  // sibling built first for its tests still needs to sort after it.
  const workspaceNames = new Set(infos.map((info) => info.packageName));

  return infos.map((info) => ({
    ...info,
    localDependencies: [
      ...new Set(
        [
          ...Object.keys(info.packageJson.dependencies ?? {}),
          ...Object.keys(info.packageJson.devDependencies ?? {}),
          ...Object.keys(info.packageJson.peerDependencies ?? {}),
        ].filter((dependency) => workspaceNames.has(dependency)),
      ),
    ],
  }));
}

export function sortWorkspacesTopologically(workspaces) {
  const pending = new Map(
    workspaces.map((workspace) => [workspace.packageName, workspace]),
  );
  const sorted = [];

  while (pending.size > 0) {
    const ready = [...pending.values()]
      .filter((workspace) =>
        workspace.localDependencies.every(
          (dependency) => !pending.has(dependency),
        ),
      )
      .sort((left, right) => left.packageName.localeCompare(right.packageName));

    if (ready.length === 0) {
      throw new Error("Circular workspace dependency detected.");
    }

    for (const workspace of ready) {
      sorted.push(workspace);
      pending.delete(workspace.packageName);
    }
  }

  return sorted;
}

export function toArtifactDirectoryName(packageName) {
  return packageName.replace(/^@/, "").replace(/\//g, "-");
}
