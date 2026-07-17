import test from "node:test";
import assert from "node:assert/strict";

import {
  bar,
  createDescriptorFromB,
  createMessageFromB,
  type ModuleBDescriptor,
} from "../../src/index.ts";

test("module b exposes its message", () => {
  assert.equal(createMessageFromB(), "message from module-b");
  assert.equal(bar(), "bar() from module-b");

  const descriptor: ModuleBDescriptor = createDescriptorFromB();

  assert.deepEqual(descriptor, {
    module: "b",
    message: "message from module-b",
  });
});
