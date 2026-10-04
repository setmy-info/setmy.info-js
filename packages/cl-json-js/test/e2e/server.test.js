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
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /<script src="dist\/cl-json\.min\.js"><\/script>/);
    assert.match(body, /src="pages\/home\.json"/);
});

test("the running instance serves the built browser bundle", async () => {
    const response = await fetch(`${baseUrl}/dist/cl-json.min.js`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/javascript/);
    assert.match(body, /ClJson/);
});

test("the running instance serves the JSON-CL resources", async () => {
    const response = await fetch(`${baseUrl}/pages/home.json`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.ok(Array.isArray(await response.json()));
});

test("the running instance answers 404 outside web/", async () => {
    assert.equal((await fetch(`${baseUrl}/missing.json`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/../package.json`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/%2e%2e/package.json`)).status, 404);
    // A malformed percent-encoding is a 404 too, not an uncaught URIError.
    assert.equal((await fetch(`${baseUrl}/%`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/pages/home.json`)).status, 200);
});
