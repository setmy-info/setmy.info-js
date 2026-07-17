import test from "node:test";
import assert from "node:assert/strict";

import {
  createDescriptorFromD,
  createMessageFromD,
  qux,
} from "../../src/index.js";

test("module d composes module c", () => {
  assert.equal(
    createMessageFromD(),
    "message from module-a + message from module-b -> module-c -> module-d",
  );
  assert.equal(qux(), "qux() from module-d");
  assert.deepEqual(createDescriptorFromD(), {
    module: "d",
    dependency: {
      module: "c",
      dependencies: [
        {
          module: "a",
          message: "message from module-a",
        },
        {
          module: "b",
          message: "message from module-b",
        },
      ],
    },
  });
});
