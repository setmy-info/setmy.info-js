import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..");
export const packagesDir = path.join(rootDir, "packages");

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
    srcEntry: path.join(workspace, "src", "index.js"),
    distDir: path.join(workspace, "dist"),
  };
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

  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name))
    .filter((workspacePath) =>
      fs.existsSync(path.join(workspacePath, "package.json")),
    )
    .map((workspacePath) => {
      const info = getWorkspaceInfo(workspacePath);

      return {
        ...info,
        localDependencies: Object.keys(
          info.packageJson.dependencies ?? {},
        ).filter((dependency) => dependency.startsWith("@demo/")),
      };
    });
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
