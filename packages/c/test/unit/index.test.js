import test from "node:test";
import assert from "node:assert/strict";

import {
    baz,
    createDescriptorFromC,
    createMessageFromC,
} from "../../src/index.js";

test("module c composes modules a and b", () => {
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
