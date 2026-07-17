import test from "node:test";
import assert from "node:assert/strict";

import {
  bar,
  createDescriptorFromB,
  createMessageFromB,
} from "../../dist/index.js";

test("module b integration uses the built non-minified artifact", () => {
  assert.equal(createMessageFromB(), "message from module-b");
  assert.equal(bar(), "bar() from module-b");
  assert.deepEqual(createDescriptorFromB(), {
    module: "b",
    message: "message from module-b",
  });
});
