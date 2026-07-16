import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const toolPath = path.join(rootDir, "tools", "http-server.js");
const stateDirectory = path.join(rootDir, ".artifacts", "http-servers");

test("http server tool starts, serves files, and stops by port", async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "demo-http-server-"));
  const port = 43123;
  const filePath = path.join(tempDirectory, "index.html");

  fs.writeFileSync(filePath, "<h1>ok</h1>");

  try {
    execFileSync(process.execPath, [toolPath, "stop", "--port", String(port)], {
      cwd: rootDir,
      stdio: "pipe",
    });

    execFileSync(
      process.execPath,
      [toolPath, "start", "--port", String(port), "--directory", tempDirectory],
      { cwd: rootDir, stdio: "pipe" },
    );

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/index.html`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.equal(body, "<h1>ok</h1>");
    });

    const stateFile = path.join(stateDirectory, `${port}.json`);
    assert.equal(fs.existsSync(stateFile), true);

    execFileSync(process.execPath, [toolPath, "stop", "--port", String(port)], {
      cwd: rootDir,
      stdio: "pipe",
    });

    await waitFor(async () => {
      await assert.rejects(fetch(`http://127.0.0.1:${port}/index.html`));
    });
  } finally {
    try {
      execFileSync(process.execPath, [toolPath, "stop", "--port", String(port)], {
        cwd: rootDir,
        stdio: "pipe",
      });
    } catch {
      // ignore cleanup failures in test teardown
    }

    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("http server tool requires a valid directory when starting", () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        [toolPath, "start", "--port", "43124", "--directory", path.join(os.tmpdir(), "missing-directory")],
        { cwd: rootDir, stdio: "pipe" },
      );
    },
    /Directory does not exist/,
  );
});

test("workspace server uses package.json defaults and serves index.html for slash requests", async () => {
  const workspaceDirectory = path.join(rootDir, "packages", "a");
  const port = 43131;
  const stateFile = path.join(stateDirectory, `${port}.json`);

  try {
    execFileSync(process.execPath, [toolPath, "stop"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    execFileSync(process.execPath, [toolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(body, /Module A web example/);
    });

    assert.equal(fs.existsSync(stateFile), true);

    execFileSync(process.execPath, [toolPath, "stop"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    await waitFor(async () => {
      await assert.rejects(fetch(`http://127.0.0.1:${port}/index.html`));
    });
  } finally {
    try {
      execFileSync(process.execPath, [toolPath, "stop"], {
        cwd: workspaceDirectory,
        stdio: "pipe",
      });
    } catch {
      // ignore cleanup failures in test teardown
    }

    fs.rmSync(stateFile, { force: true });
  }
});

test("workspace server lists directory contents when no index.html exists", async () => {
  const workspaceDirectory = path.join(rootDir, "packages", "a");
  const port = 43131;

  try {
    execFileSync(process.execPath, [toolPath, "stop"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    execFileSync(process.execPath, [toolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/empty/`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(body, /Index of \/empty\//);
      assert.match(body, /\.empty/);
    });
  } finally {
    try {
      execFileSync(process.execPath, [toolPath, "stop"], {
        cwd: workspaceDirectory,
        stdio: "pipe",
      });
    } catch {
      // ignore cleanup failures in test teardown
    }
  }
});

test("workspace server returns an HTML error page for missing directories", async () => {
  const workspaceDirectory = path.join(rootDir, "packages", "a");
  const port = 43131;

  try {
    execFileSync(process.execPath, [toolPath, "stop"], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    execFileSync(process.execPath, [toolPath], {
      cwd: workspaceDirectory,
      stdio: "pipe",
    });

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/missing/`);
      const body = await response.text();
      assert.equal(response.status, 404);
      assert.match(response.headers.get("content-type"), /^text\/html;/);
      assert.match(body, /404 Not Found/);
      assert.match(body, /\/missing\//);
    });
  } finally {
    try {
      execFileSync(process.execPath, [toolPath, "stop"], {
        cwd: workspaceDirectory,
        stdio: "pipe",
      });
    } catch {
      // ignore cleanup failures in test teardown
    }
  }
});

test("workspace package exposes an explicit stop-server script", () => {
  const workspacePackageJsonPath = path.join(rootDir, "packages", "a", "package.json");
  const workspacePackageJson = JSON.parse(fs.readFileSync(workspacePackageJsonPath, "utf8"));

  assert.equal(
    workspacePackageJson.scripts["stop-server"],
    "node ../../tools/http-server.js stop",
  );
});

async function waitFor(callback, timeoutMs = 5_000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await callback();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw lastError;
}