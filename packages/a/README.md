# `@demo/module-a`

Workspace module `a` is a base module in the monorepo lifecycle demo.

### Build output

Running `npm run build` creates:

- `dist/index.js`
- `dist/index.min.js`

### Module scripts

```powershell
$env:Path = 'C:\pub\node-v24.15.0-win-x64;' + $env:Path
npm run server
npm run stop-server
npm run validate
npm run build
npm test
npm run integration-test
npm run e2e-test
npm run package
npm run deploy
```

### Static web example

`npm run server` starts the shared root `tools/http-server.js` with defaults from `package.json`:

- `config.server.port`: `43131`
- `config.server.directory`: `web`

Open `http://127.0.0.1:43131/` to serve `web/index.html` as the default document.

Stop it with `npm run stop-server`.

### Test lifecycle hooks

`pre-integration-test`, `post-integration-test`, `pre-e2e-test`, and `post-e2e-test` now auto-load package-local hook files when they exist:

- `pre.it.js`
- `post.it.js`
- `pre.e2e.js`
- `post.e2e.js`

Module `a` includes an example that starts the shared HTTP server on port `43132` before integration/e2e tests and stops it afterwards.
