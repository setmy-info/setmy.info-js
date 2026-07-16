import test from "node:test";
import assert from "node:assert/strict";

import { createDescriptorFromA, createMessageFromA } from "../src/index.js";

test("module a exposes its message", () => {
  assert.equal(createMessageFromA(), "message from module-a");
  assert.deepEqual(createDescriptorFromA(), {
    module: "a",
    message: "message from module-a",
  });
});
