// E2E tier: real HTTP requests against the module's running instance
// (src/server.js serving web/), started by the pre-e2e-test lifecycle phase
// (`npm run pre-e2e-test`, scripts/lifecycle.js) and stopped by post-e2e-test.
// The port is read the same way the instance read it: package.json config.port.
import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";

const { port } = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).config;
const baseUrl = `http://127.0.0.1:${port}`;

test("the running instance serves the page", async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /<script src="dist\/cl-json\.min\.js"><\/script>/);
    assert.match(body, /src="pages\/home\.json"/);
});

test("the running instance serves the JSON resources and the bundle", async () => {
    for (const [file, type] of [
        ["pages/home.json", /application\/json/],
        ["dist/cl-json.min.js", /text\/javascript/],
    ]) {
        const response = await fetch(`${baseUrl}/${file}`);
        assert.equal(response.status, 200, file);
        assert.match(response.headers.get("content-type"), type);
    }
    await (await fetch(`${baseUrl}/pages/home.json`)).json();
});

test("the running instance answers 404 outside web/", async () => {
    assert.equal((await fetch(`${baseUrl}/missing.json`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/../package.json`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/%2e%2e/package.json`)).status, 404);
});
