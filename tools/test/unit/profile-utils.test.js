import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CANONICAL_PROFILES,
  requireCanonicalProfile,
  resolveProfileArg,
} from "../../profile-utils.js";

test("CANONICAL_PROFILES is exactly the ADR-0041 six", () => {
  assert.deepEqual(CANONICAL_PROFILES, [
    "local",
    "dev",
    "ci",
    "test",
    "prelive",
    "live",
  ]);
});

test("requireCanonicalProfile accepts every canonical name", () => {
  for (const profile of CANONICAL_PROFILES) {
    assert.equal(requireCanonicalProfile(profile), profile);
  }
});

test("requireCanonicalProfile throws (not process.exit) on a missing value", () => {
  assert.throws(() => requireCanonicalProfile(undefined), /Missing profile/);
});

test("requireCanonicalProfile throws on a non-canonical name", () => {
  assert.throws(
    () => requireCanonicalProfile("staging"),
    /Invalid profile "staging"/,
  );
});

test("resolveProfileArg reads --profile from argv", () => {
  assert.equal(resolveProfileArg(["--profile", "live"]), "live");
});

test("resolveProfileArg falls back to BUILD_PROFILE when argv has no flag", () => {
  const previous = process.env.BUILD_PROFILE;

  process.env.BUILD_PROFILE = "prelive";

  try {
    assert.equal(resolveProfileArg([]), "prelive");
  } finally {
    if (previous === undefined) {
      delete process.env.BUILD_PROFILE;
    } else {
      process.env.BUILD_PROFILE = previous;
    }
  }
});

test("resolveProfileArg prefers --profile over BUILD_PROFILE when both are set", () => {
  const previous = process.env.BUILD_PROFILE;

  process.env.BUILD_PROFILE = "live";

  try {
    assert.equal(resolveProfileArg(["--profile", "dev"]), "dev");
  } finally {
    if (previous === undefined) {
      delete process.env.BUILD_PROFILE;
    } else {
      process.env.BUILD_PROFILE = previous;
    }
  }
});

test("resolveProfileProperties layers a workspace-local profile over the root one", async () => {
  // Exercises resolveProfileProperties's fs-backed layering without
  // spawning a subprocess - a temp workspace dir with its own
  // profiles/local.json is enough to prove precedence, matching the
  // equivalent (subprocess-level) integration test in
  // tools/test/integration/resources.test.js.
  const { resolveProfileProperties } = await import("../../profile-utils.js");
  const workspaceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "demo-profile-utils-"),
  );

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "profiles"));
    fs.writeFileSync(
      path.join(workspaceDirectory, "profiles", "local.json"),
      JSON.stringify({ apiBaseUrl: "http://workspace-override:4000" }),
    );

    const properties = resolveProfileProperties("local", workspaceDirectory);

    assert.equal(properties.apiBaseUrl, "http://workspace-override:4000");
    assert.equal(properties.profile, "local");
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});

test("resolveProfileProperties throws a clear error on invalid JSON", async () => {
  const { resolveProfileProperties } = await import("../../profile-utils.js");
  const workspaceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "demo-profile-utils-invalid-"),
  );

  try {
    fs.mkdirSync(path.join(workspaceDirectory, "profiles"));
    fs.writeFileSync(
      path.join(workspaceDirectory, "profiles", "local.json"),
      "{ not valid json",
    );

    assert.throws(
      () => resolveProfileProperties("local", workspaceDirectory),
      /Invalid profile JSON/,
    );
  } finally {
    fs.rmSync(workspaceDirectory, { recursive: true, force: true });
  }
});
