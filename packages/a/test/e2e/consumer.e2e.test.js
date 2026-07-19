import test from "node:test";
import assert from "node:assert/strict";

import {
    createDescriptorFromA,
    createMessageFromA,
    foo,
} from "../../dist/index.min.js";

test("module a e2e uses the built minified artifact", () => {
    assert.equal(createMessageFromA(), "message from module-a");
    assert.equal(foo(), "foo() from module-a");
    assert.deepEqual(createDescriptorFromA(), {
        module: "a",
        message: "message from module-a",
    });
});
