import test from "node:test";
import assert from "node:assert/strict";

import {
  createDescriptorFromA,
  createMessageFromA,
  foo,
} from "../../dist/index.js";

test("module a integration uses the built non-minified artifact", () => {
  assert.equal(createMessageFromA(), "message from module-a");
  assert.equal(foo(), "foo() from module-a");
  assert.deepEqual(createDescriptorFromA(), {
    module: "a",
    message: "message from module-a",
  });
});
