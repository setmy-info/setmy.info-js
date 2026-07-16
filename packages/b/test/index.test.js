import test from "node:test";
import assert from "node:assert/strict";

import { createDescriptorFromB, createMessageFromB } from "../src/index.js";

test("module b exposes its message", () => {
  assert.equal(createMessageFromB(), "message from module-b");
  assert.deepEqual(createDescriptorFromB(), {
    module: "b",
    message: "message from module-b",
  });
});
