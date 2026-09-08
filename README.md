# setmy.info-js

Monorepo for JavaScript and TypeScript modules, libraries, applications and API-s.

A plain **Node.js 24+ / npm workspaces** repository: every package under `packages/` is independently versioned,
independently publishable to the npm registry and independently runnable. There is no build system on top of npm -
the commands below are the ones any Node developer already knows (`package.json` scripts), tests run with Node's own
test runner (`node --test`), and the tooling is one devDependency per job. Not a Maven lifecycle: Maven's phases are
not emulated, only its three-tier test separation and its pre-/post-step shape around the slower tiers are kept.

## Packages

- `commons` (npm `@setmy-info/commons`) - **not a demo**: the real, reusable library of this repo, Spring Boot style
  layered application configuration. The JavaScript row of `clj-commons` / `python-commons` / setmy.info-python's
  `smi_commons` / setmy.info-elixir's `SetmyInfo.Commons` - see "Application configuration" below.
- `a` (`@setmy-info/demo-module-a`) - base module, no local dependencies
- `b` (`@setmy-info/demo-module-b`) - base module, no local dependencies; **TypeScript**, the typed worked example
- `c` (`@setmy-info/demo-module-c`) - depends on `a` and `b`
- `d` (`@setmy-info/demo-module-d`) - depends on `c`, the deepest node in the demo graph

Each demo module is a real running instance: `npm run server -w @setmy-info/demo-module-<x>` serves the module's own
`web/index.html` (and its browser bundle, `web/dist/index.min.js`) with `node:http` on its configured port
(`48201`/`48211`/`48221`/`48231` for a/b/c/d, from each module's bundled `resources/application.yaml`). A module has
`src/index.*` (the library, pure), `src/config.*` (its configuration through `commons`) and `src/server.*` (the
instance); `npm run build` bundles the three with esbuild into `dist/` (Node, dependencies external) and `src/index.*`
into `web/dist/index.min.js` (browser). TypeScript needs no transpiler step of its own: Node runs `.ts` files directly
(type stripping), `tsc --noEmit` only type-checks, esbuild builds the tarball's `dist/`.

## Getting started

```sh
npm ci                                 # every workspace and the tooling, from package-lock.json
npm run build
npm test                               # unit tier
npm run server -w @setmy-info/demo-module-a    # http://127.0.0.1:48201/
```

Formatting is a **local** concern: `npm run format` rewrites the files, CI only verifies with
`npm run format:check` (a reformat in CI would leave changes in the Jenkins workspace that are never committed). Both
commands run the sequential list in `scripts/format.js` - each tool owns one file set, in order, and the first
failure stops the run. This template lists Prettier only (JS/TS/json/md); a derived project (LESS, Angular, ...)
adds its own tools next to it, the same idea as `scripts/lifecycle.js`. Turn on format-on-save in your editor, or
add a pre-commit hook:

```sh
printf '#!/bin/sh\nnpm run format:check && npm run lint\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Application configuration (`commons` / `@setmy-info/commons`)

Module names, function names and argument order are kept one-to-one with setmy.info-python's `smi_commons`,
`python-commons` (`smi_python_commons.config.application`) and the Elixir row (`SetmyInfo.Commons.Config.*`):

| `@setmy-info/commons`            | smi_commons / python-commons / Elixir                              |
| -------------------------------- | ------------------------------------------------------------------ |
| `Application` (`src/config.js`)  | `smi_commons.config` / `config.application` / `Config.Application` |
| `constants` (`src/constants.js`) | `smi_commons.constants` / `config.constants` / `Config.Constants`  |
| `overrides` (`src/overrides.js`) | `smi_commons.overrides` / _(none)_ / `Config.Overrides`            |
| `strings` (`src/strings.js`)     | `smi_commons.strings` / `string.operations` / `String.Operations`  |

### Overload order

Each layer overrides the one above it:

1. `application.{json,yml,yaml}` from each config path, in order (`./resources`, `./test/resources` by default; an
   application passes its own, the demo modules pass their bundled `resources/`)
2. `application-<profile>.{json,yml,yaml}` for each active profile
3. optional files from `SMI_OPTIONAL_CONFIG_FILES`, then from `--smi-optional-config-files`
4. `${ENV_VAR}` placeholders inside those files, resolved _before_ parsing, so `port: ${PORT}` with `PORT=8080` yields
   the number `8080`
5. environment variables - `SMI_SERVER_PORT` overrides `smi.server.port`
6. CLI options - `--smi-server-port 9090` overrides both

```js
import { Application } from "@setmy-info/commons";

const application = new Application(process.argv.slice(2), { configPaths: ["./resources"] });
const port = application.get("smi.server.port", 8080);
```

```sh
SMI_SERVER_PORT=9090 node src/server.js --smi-profiles dev --smi-server-port 9091
npx smi-commons --smi-config-paths packages/commons/test/resources --smi-profiles dev   # resolved config as JSON
```

Files merge **deeply**. `local` is the default active profile (ADR-0041's developer-machine environment);
`SMI_PROFILES` replaces the list, `--smi-profiles` replaces it again. Environment and CLI can only override _existing_
leaf keys under the `smi` root, and an override is coerced to the type of the value it replaces (`port: 8080` stays a
number, `secure: false` a boolean, a list splits on commas). Profile names follow ADR-0041 / ADR-0042: `local`, `dev`,
`ci`, `test`, `prelive`, `live`. `yaml` (no transitive dependencies) is the library's one runtime dependency - Node has
no YAML parser of its own.

## Tests

Three tiers, kept strictly apart by directory - `test/unit/`, `test/integration/`, `test/e2e/` in every package - and
run one tier at a time with Node's own test runner (`scripts/test.js` = `node --test` over `packages/*/test/<tier>/`):

```sh
npm test                    # unit
npm run integration-test    # integration
npm run e2e-test            # e2e
npm run coverage            # all three tiers in one run, under coverage
```

- `test/unit/` - fast, in-process, no files, no environment, no network
- `test/integration/` - the public API surface, configuration files, environment variables
- `test/e2e/` - the package driven end to end; for each demo module real HTTP requests against its own running
  instance, for `commons` its CLI as a real process

Every run also writes **JUnit XML** to `reports/junit/<tier>.xml` (Node's `junit` reporter) - what Jenkins' `junit`
step reads.

### Integration and e2e run against real running instances

The integration and e2e tiers are bracketed by **generic pre and post phases** - the shape of Maven failsafe's
`pre-integration-test` / `integration-test` / `post-integration-test`, without Maven:

```sh
npm run pre-e2e-test        # everything the tier needs, up
npm run e2e-test
npm run post-e2e-test       # cleanup; idempotent - run it after a failed tier too

node scripts/lifecycle.js pre-integration-test pre-e2e-test    # several phases at once, e.g.
npm run coverage                                               # around the all-tiers coverage
node scripts/lifecycle.js post-integration-test post-e2e-test  # run; shared steps run once
```

**WHAT the phases do is defined in exactly one place, `scripts/lifecycle.js`** - a phase is a list of steps (async
functions), and this repo is a template: a project started from it adds what its own tiers need there (a database, a
message broker, a mock of a third-party API, docker compose up/down, seeding test data, ...). Post steps must stay
idempotent: CI runs them again after a failed tier, and `npm run clean` runs them before removing their state.

In this template the steps start and stop the demo modules' instances (`scripts/servers.js`): each module's port is
read the way the module itself reads it (its `src/config`), whatever an aborted run left behind is stopped first, each
instance starts detached (pid and log under `build/servers/`) and the step waits until every port answers. What the
e2e tier exercises is therefore the running program - what gets deployed - not code hosted inside the test runner.
`SMI_PROFILES=ci` in the environment makes both the instances and the tests use the `ci` profile, which is what CI
does.

## Quality and reports

| Command                | Tool                                       | What                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check` | `scripts/format.js`                        | sequential formatters, check half (gate); this template: Prettier                                                                                                                          |
| `npm run typecheck`    | TypeScript                                 | `tsc --noEmit` in the TypeScript modules (gate)                                                                                                                                            |
| `npm run lint`         | ESLint + eslint-plugin-security            | lint (gate); the security rules are the static security analysis of this row, as warnings                                                                                                  |
| `npm run audit`        | `npm audit --audit-level=high`             | **dependency vulnerability check** against the npm advisory database (gate) - the OWASP dependency-check of this row                                                                       |
| `npm run coverage`     | `node --test --experimental-test-coverage` | **test coverage** over all three tiers, fails below 90 % lines; lcov in `reports/coverage/`                                                                                                |
| `npm run reports`      | npm                                        | the documents: `npm audit --json` (`reports/security/`), CycloneDX **SBOM** from `npm sbom` (`reports/sbom/`), the dependency tree from `npm ls --all` (`reports/dependencies.txt`)        |
| `npm run docs`         | JSDoc                                      | **API documentation** as HTML from the JSDoc comments of the JavaScript packages, `reports/docs/` (JSDoc does not read TypeScript, so module `b` is covered by its types, not by the docs) |

Everything under `reports/` is archived by CI. Nothing here modifies files. The dependency check, SBOM, dependency tree,
packaging and publishing are npm's own subcommands - no extra tool for any of them.

## Packaging, publishing, deploying - one tarball per package

```sh
npm run package                                  # npm pack --workspaces, one tarball per package into dist/
npm run release                                  # scripts/release.js: devel* -> -SNAPSHOT to the snapshot registry, master -> release to the release registry; dry run without a registry
npm run deploy -- prelive                        # scripts/deploy.js: the tarballs installed into build/deploy/prelive/
```

Deploying means installing the tarballs into a fresh prefix on the target and running the module there with
`SMI_PROFILES` set to the target environment. `scripts/deploy.js` proves it in the workspace: a `package.json` under
`build/deploy/<env>/` depends on every tarball and `overrides` each sibling to its tarball (a tarball's own
dependencies would otherwise be resolved from the registry), `npm install --omit=dev`, then `demo-module-d` is imported
from the installed artifact under the target profile. Real target hosts are not wired up yet.

## CI

`Jenkinsfile` is the single CI definition, kept stage-for-stage in sync with `jenkinsfile-starter` 1.2.0 (no stages
added or removed, the placeholders filled): Inspection (pre-build checks ‖ build tools) → Preparation (`npm ci`,
`npm ls --all`) → Build → Publish → Deploy → Tag, with the org's standard branch gating (`master` / `devel*` /
`release*` / `hotfix*`). `SMI_PROFILES=ci` is set for the whole build. The Build stage runs, in order: `npm run clean`,
format check, typecheck and build, the unit tier, the integration tier bracketed by its `pre-integration-test` /
`post-integration-test` phases, the quality gates and documents (`lint`, `audit`, `reports`, `docs`), the e2e tier
bracketed by its phases the same way, the coverage run over all three tiers bracketed by the union of both tiers'
phases, then `npm run package`. Each is its own line, so the build log names what failed. `post { always }` runs both
post phases again (idempotent - they clean up whatever a failed tier left behind), feeds
`reports/junit/*.xml` to Jenkins' `junit` step and archives `dist/*.tgz`, `reports/` and the instance logs. Publish
runs `npm run release`: `devel*` publishes the `-SNAPSHOT` version to `NPM_SNAPSHOT_REGISTRY`, `master` the release
version (no `-SNAPSHOT`) to `NPM_RELEASE_REGISTRY`, with the token npm reads from `NPM_TOKEN` through the committed
`.npmrc.publish`; a version that does not match its branch is refused; Deploy runs `npm run deploy -- <env>` per
target. The Jenkinsfile is declarative: no helper functions beyond the starter's `runCommand`, no shell scripts next
to it - the same `npm` commands, in the same order, are the whole build on a developer machine too (`npm run clean`
removes every build result, `rm -rf node_modules` gives a from-scratch checkout, `npm run release` without a registry configured
is the Publish stage without the upload). No GitHub Actions workflow.

### Hotfix branches (`hotfix*`)

A `hotfix*` branch - branched from `master`, one fix, quick review - runs the exact same Inspection → Build path as
every other branch (all test tiers, quality, packaging), is not published (only `master` publishes), and deploys to
`test` and `prelive` (`HOTFIX_TO_TEST` / `HOTFIX_TO_PRELIVE`). It never deploys `dev` or `live` and never tags -
merging it to `master` is what does that, through the normal master build.
