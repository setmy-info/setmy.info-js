import test from "node:test";
import assert from "node:assert/strict";

import { resolveDistTag } from "../../publish.js";

test("resolveDistTag maps master to latest", () => {
  assert.equal(resolveDistTag("master"), "latest");
});

test("resolveDistTag maps release* branches to release-candidate", () => {
  assert.equal(resolveDistTag("release"), "release-candidate");
  assert.equal(resolveDistTag("release-1.2"), "release-candidate");
});

test("resolveDistTag maps devel* branches to next", () => {
  assert.equal(resolveDistTag("devel"), "next");
  assert.equal(resolveDistTag("develop"), "next");
  assert.equal(resolveDistTag("devel-feature-x"), "next");
});

test("resolveDistTag returns null for anything else (feature branches skip publish)", () => {
  assert.equal(resolveDistTag("feature/some-thing"), null);
  assert.equal(resolveDistTag("main"), null);
  assert.equal(resolveDistTag(""), null);
});
