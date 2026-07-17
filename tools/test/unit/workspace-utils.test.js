import test from "node:test";
import assert from "node:assert/strict";

import { sortWorkspacesTopologically } from "../../workspace-utils.js";

function workspace(packageName, localDependencies = []) {
  return { packageName, localDependencies };
}

test("sortWorkspacesTopologically orders dependencies before dependents", () => {
  const d = workspace("@demo/module-d", ["@demo/module-c"]);
  const c = workspace("@demo/module-c", ["@demo/module-a", "@demo/module-b"]);
  const b = workspace("@demo/module-b");
  const a = workspace("@demo/module-a");

  const sorted = sortWorkspacesTopologically([d, c, b, a]).map(
    (workspaceEntry) => workspaceEntry.packageName,
  );

  assert.ok(
    sorted.indexOf("@demo/module-a") < sorted.indexOf("@demo/module-c"),
  );
  assert.ok(
    sorted.indexOf("@demo/module-b") < sorted.indexOf("@demo/module-c"),
  );
  assert.ok(
    sorted.indexOf("@demo/module-c") < sorted.indexOf("@demo/module-d"),
  );
});

test("sortWorkspacesTopologically breaks ties alphabetically within a ready set", () => {
  const sorted = sortWorkspacesTopologically([
    workspace("@demo/module-z"),
    workspace("@demo/module-a"),
    workspace("@demo/module-m"),
  ]).map((workspaceEntry) => workspaceEntry.packageName);

  assert.deepEqual(sorted, [
    "@demo/module-a",
    "@demo/module-m",
    "@demo/module-z",
  ]);
});

test("sortWorkspacesTopologically throws on a circular dependency", () => {
  const a = workspace("@demo/module-a", ["@demo/module-b"]);
  const b = workspace("@demo/module-b", ["@demo/module-a"]);

  assert.throws(
    () => sortWorkspacesTopologically([a, b]),
    /Circular workspace dependency detected/,
  );
});

test("sortWorkspacesTopologically ignores a dependency outside the given set", () => {
  // A module can depend on something that isn't itself a workspace being
  // sorted right now (e.g. clean's reversed single-workspace invocation) -
  // that must not be mistaken for an unresolved/circular dependency.
  const c = workspace("@demo/module-c", ["@demo/module-a", "@demo/module-b"]);

  const sorted = sortWorkspacesTopologically([c]).map(
    (workspaceEntry) => workspaceEntry.packageName,
  );

  assert.deepEqual(sorted, ["@demo/module-c"]);
});
