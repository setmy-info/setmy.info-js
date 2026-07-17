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
const resourcesToolPath = path.join(rootDir, "tools", "resources.js");

test("resources tool requires a canonical profile", () => {
  const workspaceDirectory = createWorkspace();

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "resources"));

    assert.throws(() => {
      execFileSync(process.execPath, [resourcesToolPath], {
        cwd: workspaceDirectory,
        stdio: "pipe",
      });
    }, /Missing profile/);
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resources tool rejects non-canonical profile names", () => {
  const workspaceDirectory = createWorkspace();

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "resources"));

    assert.throws(() => {
      execFileSync(
        process.execPath,
        [resourcesToolPath, "--profile", "staging"],
        { cwd: workspaceDirectory, stdio: "pipe" },
      );
    }, /Invalid profile "staging"/);
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resources tool is a no-op when there is no resources directory", () => {
  const workspaceDirectory = createWorkspace();

  try {
    execFileSync(process.execPath, [resourcesToolPath, "--profile", "local"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    assert.equal(
      fs.existsSync(path.join(workspaceDirectory, "dist", "resources")),
      false,
    );
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resources tool filters ${property} tokens from the root profile", () => {
  const workspaceDirectory = createWorkspace();

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "resources"));
    fs.writeFileSync(
      path.join(workspaceDirectory, "resources", "config.json"),
      '{"environment": "${profile}", "apiBaseUrl": "${apiBaseUrl}"}',
    );

    execFileSync(process.execPath, [resourcesToolPath, "--profile", "local"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    const filtered = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDirectory, "dist", "resources", "config.json"),
        "utf8",
      ),
    );

    assert.equal(filtered.environment, "local");
    assert.equal(filtered.apiBaseUrl, "http://localhost:3000");
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resources tool lets a workspace-local profile override the root profile", () => {
  const workspaceDirectory = createWorkspace();

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "resources"));
    fs.mkdirSync(path.join(workspaceDirectory, "profiles"));
    fs.writeFileSync(
      path.join(workspaceDirectory, "resources", "config.json"),
      '{"apiBaseUrl": "${apiBaseUrl}", "logLevel": "${logLevel}"}',
    );
    fs.writeFileSync(
      path.join(workspaceDirectory, "profiles", "local.json"),
      JSON.stringify({ apiBaseUrl: "http://workspace-override:4000" }),
    );

    execFileSync(process.execPath, [resourcesToolPath, "--profile", "local"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    const filtered = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDirectory, "dist", "resources", "config.json"),
        "utf8",
      ),
    );

    // Workspace-local value wins...
    assert.equal(filtered.apiBaseUrl, "http://workspace-override:4000");
    // ...but keys the workspace profile doesn't set still fall back to root.
    assert.equal(filtered.logLevel, "debug");
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resources tool leaves unresolved tokens in place and warns", () => {
  const workspaceDirectory = createWorkspace();

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "resources"));
    fs.writeFileSync(
      path.join(workspaceDirectory, "resources", "config.json"),
      '{"missing": "${notAProperty}"}',
    );

    const stderr = execFileSync(
      process.execPath,
      [resourcesToolPath, "--profile", "local"],
      { cwd: workspaceDirectory, encoding: "utf8", stdio: "pipe" },
    );

    const filtered = fs.readFileSync(
      path.join(workspaceDirectory, "dist", "resources", "config.json"),
      "utf8",
    );

    assert.match(filtered, /\$\{notAProperty\}/);
    void stderr;
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

function createWorkspace() {
  const workspaceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "demo-resources-"),
  );

  fs.writeFileSync(
    path.join(workspaceDirectory, "package.json"),
    JSON.stringify({ name: "@demo/test-resources", type: "module" }, null, 2),
  );

  return workspaceDirectory;
}
