import test from "node:test";
import assert from "node:assert/strict";

import { escapeHtml, parseLcov } from "../../site-utils.js";

test("escapeHtml escapes all five reserved characters", () => {
    assert.equal(
        escapeHtml(`<script>alert("x & y's here")</script>`),
        "&lt;script&gt;alert(&quot;x &amp; y&#39;s here&quot;)&lt;/script&gt;",
    );
});

test("escapeHtml coerces non-string input", () => {
    assert.equal(escapeHtml(42), "42");
});

test("parseLcov reads line coverage totals per file", () => {
    const lcov = [
        "TN:",
        "SF:src/index.js",
        "FN:7,createMessageFromA",
        "FNF:1",
        "FNH:1",
        "DA:1,1",
        "DA:2,0",
        "LH:1",
        "LF:2",
        "end_of_record",
    ].join("\n");

    assert.deepEqual(parseLcov(lcov), [
        { file: "src/index.js", linesFound: 2, linesHit: 1 },
    ]);
});

test("parseLcov reads multiple SF: records", () => {
    const lcov = [
        "SF:a.js",
        "LH:1",
        "LF:1",
        "end_of_record",
        "SF:b.js",
        "LH:0",
        "LF:3",
        "end_of_record",
    ].join("\n");

    assert.deepEqual(parseLcov(lcov), [
        { file: "a.js", linesFound: 1, linesHit: 1 },
        { file: "b.js", linesFound: 3, linesHit: 0 },
    ]);
});

test("parseLcov returns an empty list for empty input", () => {
    assert.deepEqual(parseLcov(""), []);
});
