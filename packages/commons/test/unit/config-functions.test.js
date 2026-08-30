import test from "node:test";
import assert from "node:assert/strict";

import {
    applicationFiles,
    cliList,
    environmentList,
    findLastNotNoneAndEmpty,
    mergeConfig,
    mergeDicts,
} from "../../src/config.js";

test("environmentList and cliList split comma separated values", () => {
    assert.deepEqual(
        environmentList({ SMI_PROFILES: "dev, ci" }, "SMI_PROFILES"),
        ["dev", "ci"],
    );
    assert.deepEqual(environmentList({}, "SMI_PROFILES"), []);
    assert.deepEqual(cliList(["--smi-profiles", "a,b"], "--smi-profiles"), [
        "a",
        "b",
    ]);
    assert.deepEqual(cliList(["--smi-profiles=c"], "--smi-profiles"), ["c"]);
    assert.deepEqual(cliList([], "--smi-profiles"), []);
});

test("findLastNotNoneAndEmpty takes the last non-empty list", () => {
    assert.deepEqual(findLastNotNoneAndEmpty(["local"], [], ["dev"]), ["dev"]);
    assert.deepEqual(findLastNotNoneAndEmpty(["local"], ["ci"], []), ["ci"]);
    assert.deepEqual(findLastNotNoneAndEmpty([], undefined, null), []);
});

test("mergeDicts merges deeply, right wins, null on the right keeps the left", () => {
    const left = { smi: { server: { port: 1, secure: false }, tags: ["a"] } };
    const right = { smi: { server: { port: 2 }, tags: null, extra: true } };
    assert.deepEqual(mergeDicts(left, right), {
        smi: { server: { port: 2, secure: false }, tags: ["a"], extra: true },
    });
    assert.deepEqual(mergeDicts({ a: 1 }, "scalar"), "scalar");
    assert.deepEqual(mergeDicts(["x"], ["y"]), ["y"]);
    assert.deepEqual(mergeConfig([{ a: 1 }, { b: 2 }, { a: 3 }]), {
        a: 3,
        b: 2,
    });
});

test("applicationFiles lists json, yml, yaml per prefix in order", () => {
    assert.deepEqual(applicationFiles(["dev", "ci"]), [
        "application.json",
        "application.yml",
        "application.yaml",
        "application-dev.json",
        "application-dev.yml",
        "application-dev.yaml",
        "application-ci.json",
        "application-ci.yml",
        "application-ci.yaml",
    ]);
});
