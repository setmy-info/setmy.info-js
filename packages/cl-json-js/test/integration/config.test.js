// Integration tier: the public API surface, the bundled configuration files
// and the environment - real files read, an explicit environment (so the
// tests are independent of the runner's own environment; CI sets
// SMI_PROFILES=ci).
import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../../src/config.js";

test("bundled defaults under the local profile", () => {
    const application = config([], { environment: {} });
    assert.equal(application.name, "cl-json-js");
    assert.deepEqual(application.profiles, ["local"]);
    assert.equal(application.get("smi.server.host"), "0.0.0.0");
    assert.equal(application.get("smi.server.port"), 48241);
    assert.equal(application.get("smi.log.level"), "debug");
});

test("profile from the environment", () => {
    assert.equal(
        config([], { environment: { SMI_PROFILES: "ci" } }).get(
            "smi.log.level",
        ),
        "info",
    );
    const live = config([], { environment: { SMI_PROFILES: "live" } });
    assert.equal(live.get("smi.log.level"), "warn");
    assert.equal(live.get("smi.server.host"), "127.0.0.1");
});

test("environment, then CLI override the port and the host", () => {
    const environment = { SMI_SERVER_PORT: "48901", SMI_SERVER_HOST: "::1" };
    const fromEnvironment = config([], { environment });
    assert.equal(fromEnvironment.get("smi.server.port"), 48901);
    assert.equal(fromEnvironment.get("smi.server.host"), "::1");
    assert.equal(
        config(["--smi-server-port", "48902"], { environment }).get(
            "smi.server.port",
        ),
        48902,
    );
});
