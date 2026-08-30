import test from "node:test";
import assert from "node:assert/strict";

import {
    allCliOptionNames,
    applyOverrides,
    cliOptionNames,
    cliOverrides,
    coerceLike,
    collect,
    environmentOverrides,
    environmentVariableNames,
    findOptionValue,
    getIn,
    leafPaths,
    toDottedObject,
} from "../../src/overrides.js";

const CONFIG = {
    application: { name: "demo" },
    smi: {
        server: { port: 8080, secure: false },
        apiBaseUrl: "http://localhost",
        tags: ["a"],
        ratio: 0.5,
        empty: {},
    },
};

test("leafPaths restricted to root keys", () => {
    assert.deepEqual(leafPaths(CONFIG, ["smi"]), [
        ["smi", "server", "port"],
        ["smi", "server", "secure"],
        ["smi", "apiBaseUrl"],
        ["smi", "tags"],
        ["smi", "ratio"],
        ["smi", "empty"],
    ]);
    assert.ok(
        leafPaths(CONFIG, null).some(
            (path) => path.join(".") === "application.name",
        ),
    );
});

test("name variants", () => {
    assert.deepEqual(environmentVariableNames(["smi", "server", "port"]), [
        "SMI_SERVER_PORT",
    ]);
    assert.deepEqual(environmentVariableNames(["smi", "apiBaseUrl"]), [
        "SMI_API_BASE_URL",
        "SMI_APIBASEURL",
    ]);
    assert.deepEqual(cliOptionNames(["smi", "apiBaseUrl"]), [
        "--smi-api-base-url",
        "--smi-apibaseurl",
    ]);
    assert.deepEqual(cliOptionNames(["smi", "some.key"]), ["--smi-some-key"]);
    assert.ok(allCliOptionNames(CONFIG).includes("--smi-server-port"));
    assert.ok(!allCliOptionNames(CONFIG).includes("--application-name"));
});

test("coerceLike follows the current type", () => {
    assert.equal(coerceLike(false, "true"), true);
    assert.equal(coerceLike(8080, "9090"), 9090);
    assert.equal(coerceLike(8080, "nope"), 8080);
    assert.equal(coerceLike(0.5, "0.75"), 0.75);
    assert.deepEqual(coerceLike(["a"], "b, c"), ["b", "c"]);
    assert.equal(coerceLike("text", "other"), "other");
    assert.equal(coerceLike(undefined, "value"), "value");
});

test("collect uses the first present candidate", () => {
    const lookup = {
        SMI_APIBASEURL: "flat",
        SMI_API_BASE_URL: "snake",
        SMI_SERVER_PORT: "1",
    };
    const result = collect(
        CONFIG,
        ["smi"],
        environmentVariableNames,
        (name) => lookup[name],
    );
    assert.deepEqual(toDottedObject(result), {
        "smi.server.port": 1,
        "smi.apiBaseUrl": "snake",
    });
});

test("environmentOverrides skip the reserved control variables", () => {
    const config = { smi: { profiles: ["local"], server: { port: 1 } } };
    const result = environmentOverrides(config, {
        SMI_PROFILES: "dev",
        SMI_SERVER_PORT: "2",
    });
    assert.deepEqual(toDottedObject(result), { "smi.server.port": 2 });
});

test("findOptionValue forms, last one wins", () => {
    const argv = ["--smi-server-port", "1", "--smi-server-port=2", "--other"];
    assert.equal(findOptionValue(argv, "--smi-server-port"), "2");
    assert.equal(findOptionValue(argv, "--missing"), undefined);
    assert.equal(findOptionValue(["--flag"], "--flag"), undefined);
});

test("cliOverrides and applyOverrides do not mutate the source", () => {
    const result = cliOverrides(CONFIG, [
        "--smi-server-secure",
        "yes",
        "--smi-tags=x,y",
    ]);
    const applied = applyOverrides(CONFIG, result);
    assert.equal(getIn(applied, ["smi", "server", "secure"]), true);
    assert.deepEqual(getIn(applied, ["smi", "tags"]), ["x", "y"]);
    assert.equal(getIn(CONFIG, ["smi", "server", "secure"]), false);
    assert.equal(
        getIn(CONFIG, ["smi", "nope", "deeper"], "default"),
        "default",
    );
    assert.equal(getIn(CONFIG, ["smi", "constructor"], "default"), "default");
});
