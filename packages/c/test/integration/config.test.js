// Integration tier: the public API surface, the bundled configuration files
// and the environment - real files read, an explicit environment (so the
// tests are independent of the runner's own environment; CI sets
// SMI_PROFILES=ci).
import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../../src/config.js";

test("bundled defaults under the local profile", () => {
    const application = config([], { environment: {} });
    assert.equal(application.name, "demo-module-c");
    assert.deepEqual(application.profiles, ["local"]);
    assert.equal(application.get("smi.server.port"), 48221);
    assert.equal(application.get("smi.log.level"), "debug");
});

test("profile from the environment", () => {
    assert.equal(
        config([], { environment: { SMI_PROFILES: "ci" } }).get(
            "smi.log.level",
        ),
        "info",
    );
    assert.equal(
        config([], { environment: { SMI_PROFILES: "live" } }).get(
            "smi.api.baseUrl",
        ),
        "https://api.setmy.info",
    );
});

test("environment, then CLI override the port", () => {
    const environment = { SMI_SERVER_PORT: "48901" };
    assert.equal(config([], { environment }).get("smi.server.port"), 48901);
    assert.equal(
        config(["--smi-server-port", "48902"], { environment }).get(
            "smi.server.port",
        ),
        48902,
    );
});
