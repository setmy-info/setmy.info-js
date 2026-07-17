import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = "http://127.0.0.1:43132";

test("e2e server serves the web page against the running instance", async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Module A web example/);
  assert.match(body, /dist\/index\.min\.js/);
});

test("e2e server serves the built browser artifact", async () => {
  const response = await fetch(`${baseUrl}/dist/index.min.js`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /@demo\/module-a/);
  assert.match(body, /createMessageFromA/);
});
