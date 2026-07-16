import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createDescriptorFromD,
  createMessageFromD,
  qux,
} from "../../dist/index.min.js";

test("module d e2e uses the built minified artifact", () => {
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

test("module d e2e keeps a single MIT legal note in the minified artifact", () => {
  const minifiedArtifact = fs.readFileSync(
    path.join(import.meta.dirname, "../../dist/index.min.js"),
    "utf8",
  );
  const licenseMatches =
    minifiedArtifact.match(/Licensed under the MIT License/g) ?? [];

  assert.equal(licenseMatches.length, 1);
});
