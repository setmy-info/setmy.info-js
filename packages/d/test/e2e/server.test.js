// E2E tier: real HTTP requests against the module's own running instance,
// started by the pre-e2e-test lifecycle phase (`npm run pre-e2e-test`,
// scripts/lifecycle.js) before this tier and stopped by post-e2e-test after it.
// The port is read the same way the instance itself read it.
import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../../src/config.js";

const baseUrl = `http://127.0.0.1:${config().get("smi.server.port")}`;

test("the running instance serves the web page", async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Module D web example/);
    assert.match(body, /dist\/index\.min\.js/);
});

test("the running instance serves the built browser bundle", async () => {
    const response = await fetch(`${baseUrl}/dist/index.min.js`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /createMessageFromD/);
});

test("the running instance answers 404 outside web/", async () => {
    assert.equal((await fetch(`${baseUrl}/missing.html`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/../package.json`)).status, 404);
});
