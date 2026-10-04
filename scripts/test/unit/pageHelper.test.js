// The browser-independent parts of scripts/pageHelper.js: which package a
// spec belongs to, which address the grid's browser calls back on, the URL.
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import {
    data,
    firstExternalIPv4,
    getPath,
    isLoopbackHost,
    packageNameFromStack,
    pageName,
    resolvePageHost,
} from "../../pageHelper.js";
import { testPageName } from "../../testPageName.js";

test("packageNameFromStack reads the package from a spec's path or URL", () => {
    assert.equal(
        packageNameFromStack(
            "    at file:///repo/packages/cl-json-js/test/e2e/cart.e2e.js:9:9",
        ),
        "cl-json-js",
    );
    assert.equal(
        packageNameFromStack(
            "Error\n    at x (/repo/scripts/gherkin/runner.js:1:1)\n/repo/packages/a/test/e2e/home.gherkin.e2e.js",
        ),
        "a",
    );
    assert.throws(
        () =>
            packageNameFromStack("    at x (/repo/scripts/pageHelper.js:1:1)"),
        /cannot infer the package/,
    );
});

test("loopback hosts need no interface guessing", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
        assert.equal(isLoopbackHost(host), true, host);
    }
    assert.equal(isLoopbackHost("selenium.gintra"), false);
    assert.ok(
        net.isIPv4(firstExternalIPv4()) || firstExternalIPv4() === "localhost",
    );
});

test("the page host follows E2E_PAGE_HOST and the hub", async () => {
    // Defaults of this test process: a hub on localhost unless configured.
    const host = await resolvePageHost();
    if (process.env.E2E_PAGE_HOST) {
        assert.equal(host, process.env.E2E_PAGE_HOST);
    } else if (
        !process.env.SELENIUM_HUB_URL ||
        /\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.SELENIUM_HUB_URL)
    ) {
        assert.equal(host, "127.0.0.1");
    } else {
        assert.ok(host.length > 0);
    }
});

test("a page name is <name>.html, like setmy-info-less", () => {
    data.baseUrl = "http://127.0.0.1:48241";
    pageName("index");
    assert.equal(getPath(), "http://127.0.0.1:48241/index.html");
    pageName("");
    assert.equal(getPath(), "http://127.0.0.1:48241/index.html");
});

test("testPageName is the spec file name up to its first dot", () => {
    assert.equal(
        testPageName("file:///repo/packages/x/test/e2e/cart.gherkin.e2e.js"),
        "cart",
    );
});
