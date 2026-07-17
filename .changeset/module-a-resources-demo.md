---
"@demo/module-a": patch
---

Add a `resources/config.json` template (Maven resource-filtering demo) and
a `test/e2e/server.e2e.test.js` that exercises the running `pre-e2e-test`
HTTP server, instead of only re-importing the built artifact.
