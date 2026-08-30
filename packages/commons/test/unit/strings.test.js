import test from "node:test";
import assert from "node:assert/strict";

import {
    findNamedPlaceholders,
    resolvePlaceholders,
    splitAndTrim,
    toBoolean,
    toFloat,
    toInt,
} from "../../src/strings.js";

test("splitAndTrim drops blanks and trims items", () => {
    assert.deepEqual(splitAndTrim("a, b ,,c"), ["a", "b", "c"]);
    assert.deepEqual(splitAndTrim(undefined), []);
    assert.deepEqual(splitAndTrim(null), []);
    assert.deepEqual(splitAndTrim("  "), []);
    assert.deepEqual(splitAndTrim("a;b", ";"), ["a", "b"]);
});

test("toBoolean understands the usual words, anything else is the default", () => {
    for (const word of ["true", "YES", "on", "1"]) {
        assert.equal(toBoolean(word, false), true);
    }
    for (const word of ["false", "No", "OFF", "0"]) {
        assert.equal(toBoolean(word, true), false);
    }
    assert.equal(toBoolean("maybe", true), true);
});

test("toInt and toFloat fall back to the default on garbage", () => {
    assert.equal(toInt(" 42 ", 0), 42);
    assert.equal(toInt("9.5", 7), 7);
    assert.equal(toInt("nope", 7), 7);
    assert.equal(toInt("", 7), 7);
    assert.equal(toFloat("0.75", 0), 0.75);
    assert.equal(toFloat("x", 0.5), 0.5);
});

test("placeholders resolve from the variables or stay literal", () => {
    const text = "home=${HOME_DIR} again=${HOME_DIR} missing=${NOPE}";
    assert.deepEqual(findNamedPlaceholders(text), ["HOME_DIR", "NOPE"]);
    assert.equal(
        resolvePlaceholders(text, { HOME_DIR: "/srv" }),
        "home=/srv again=/srv missing=${NOPE}",
    );
});
