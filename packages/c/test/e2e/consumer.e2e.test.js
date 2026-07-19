import test from "node:test";
import assert from "node:assert/strict";

import {
    baz,
    createDescriptorFromC,
    createMessageFromC,
} from "../../dist/index.min.js";

test("module c e2e uses the built minified artifact", () => {
    assert.equal(
        createMessageFromC(),
        "message from module-a + message from module-b -> module-c",
    );
    assert.equal(baz(), "baz() from module-c");
    assert.deepEqual(createDescriptorFromC(), {
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
    });
});
