import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const preIntegrationToolPath = path.join(
  rootDir,
  "tools",
  "preintegration-test.js",
);
const postIntegrationToolPath = path.join(
  rootDir,
  "tools",
  "postintegration-test.js",
);
const preE2eToolPath = path.join(rootDir, "tools", "pree2e-test.js");
const postE2eToolPath = path.join(rootDir, "tools", "poste2e-test.js");

test("lifecycle tools execute package-local hook files when present", () => {
  const workspaceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "demo-hooks-"),
  );
  const artifactPath = path.join(workspaceDirectory, "hook-log.json");

  try {
    fs.writeFileSync(
      path.join(workspaceDirectory, "package.json"),
      JSON.stringify({ name: "@demo/test-hooks", type: "module" }, null, 2),
    );

    fs.writeFileSync(
      path.join(workspaceDirectory, "pre.it.js"),
      createHookModule("pre-it", artifactPath),
    );
    fs.writeFileSync(
      path.join(workspaceDirectory, "post.it.js"),
      createHookModule("post-it", artifactPath),
    );
    fs.writeFileSync(
      path.join(workspaceDirectory, "pre.e2e.js"),
      createHookModule("pre-e2e", artifactPath),
    );
    fs.writeFileSync(
      path.join(workspaceDirectory, "post.e2e.js"),
      createHookModule("post-e2e", artifactPath),
    );

    execFileSync(process.execPath, [preIntegrationToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [postIntegrationToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [preE2eToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [postE2eToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    assert.deepEqual(JSON.parse(fs.readFileSync(artifactPath, "utf8")), [
      "pre-it",
      "post-it",
      "pre-e2e",
      "post-e2e",
    ]);
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("lifecycle tools stay no-op when package-local hook files are absent", () => {
  const workspaceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "demo-hooks-empty-"),
  );

  try {
    fs.writeFileSync(
      path.join(workspaceDirectory, "package.json"),
      JSON.stringify(
        { name: "@demo/test-hooks-empty", type: "module" },
        null,
        2,
      ),
    );

    execFileSync(process.execPath, [preIntegrationToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [postIntegrationToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [preE2eToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, [postE2eToolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    assert.equal(
      fs.existsSync(path.join(workspaceDirectory, "hook-log.json")),
      false,
    );
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

function createHookModule(label, artifactPath) {
  return `import fs from "node:fs";
const artifactPath = ${JSON.stringify(artifactPath)};
const entries = fs.existsSync(artifactPath)
  ? JSON.parse(fs.readFileSync(artifactPath, "utf8"))
  : [];
entries.push(${JSON.stringify(label)});
fs.writeFileSync(artifactPath, JSON.stringify(entries));\n`;
}
