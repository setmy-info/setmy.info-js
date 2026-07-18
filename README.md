# setmy.info-js

Monorepo for JavaScript, TypeScript modules, libraries, applications and API-s.

This repo doubles as a **reference implementation**: a Node.js/npm workspaces project deliberately shaped to mirror
the [Maven default build lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html#default-lifecycle),
so that Java/Maven developers can reuse the same mental model without context switching. Later Python and Elixir sibling
projects are expected to follow the same phase names, directory layout and reporting conventions. See **ADR-0045**
(software build lifecycles, in `setmy-info.github.io`) for the maintained phase-mapping table across Maven / npm /
Python / Elixir / Make, and
`requirements-rules.md` here for the language-agnostic spec (`temp.md` is the superseded pre-planning scratch copy, kept
for history only).

Maven-closeness is a **soft rule**: the phase names and ordering are kept because they buy real context-switching
savings for Maven-fluent developers, but where a 1:1 imitation would need a hack that npm/Node doesn't naturally
support, the natural npm way wins and the difference is documented ("Known deliberate differences" below).

## Modules

- `@demo/module-a` - base module `a`
- `@demo/module-b` - base module `b`
- `@demo/module-c` - depends on `a` and `b`
- `@demo/module-d` - depends on `c`

Every module has a browser-servable `web/` demo (own port, own
`pre.it.js`/`post.it.js`/`pre.e2e.js`/`post.e2e.js` hooks, own
`test/e2e/server.e2e.test.js`) — see "Test pyramid" below.

Each module is intentionally standalone (its own `package.json`, tests, dist output) even though they share one
repository, so the pattern generalizes to
"real" modules that are Node libraries, browser bundles, or full framework apps (e.g. Angular) living side by side.

## Lifecycle

Run from the repository root, in order:

```sh
npm run bootstrap          # npm ci
npm run clean
npm run validate
npm run format:check       # or: npm run format to auto-fix
npm run lint
npm run resources -- --profile <local|dev|ci|test|prelive|live>
npm run build
npm test                   # unit tests
npm run pre-integration-test
npm run integration-test
npm run post-integration-test
npm run pre-e2e-test
npm run e2e-test
npm run post-e2e-test
npm run coverage
npm run security
npm run verify
npm run package
npm run sbom
npm run sign
npm run install-local
npm run publish
DEPLOY_TARGET=dev npm run deploy   # target is required: dev|test|prelive|live
```

This whole sequence has been run clean, end to end, with a plain `npm ci` on Linux/Node 24.

`Jenkinsfile` runs this same sequence in CI, migrated from the org's
`jenkinsfile-starter` template: same stage skeleton (Inspection → Preparation → Build → E2E → Quality/reporting →
System/Acceptance → Package → Publish → Deploy → Tag), same branch-gated Publish/Deploy pattern (`master` / `devel*` /
`release*`, with per-environment `*_TO_*` deploy flags), Maven placeholders swapped for the npm scripts above. Feature
branches run Inspection through Package (full build/lint/test/quality feedback) but never reach Publish/Deploy/Tag,
which stay gated to
`master`/`devel*`/`release*`. `post-integration-test` and `post-e2e-test`
run in a stage-level `post { always { ... } }` block so a failing
`integration-test`/`e2e-test` still lets the test server get stopped — the same guarantee Maven's failsafe plugin gives
around a possibly failing
`integration-test` goal.

`.github/workflows/ci.yml` is the same pipeline ported to GitHub Actions:
Jenkins parallel stages become parallel jobs (`pre-build`/`build-tools` for Inspection; `release-publish`/
`snapshot-publish`/`release-reports`/
`snapshot-reports` for Publish; `deploy-dev`/`deploy-test`/
`deploy-prelive`/`deploy-live` for Deploy), Jenkins `when`/`expression`
branch gates become `if:` conditions on `github.ref_name`, and the
`post-integration-test`/`post-e2e-test` cleanup steps use `if: always()`
for the same guarantee. A final `notify` job (`if: always()`, depends on every other job) stands in for the
Jenkinsfile's `post { success / failure
}` `emailext` steps — real notification wiring (email/Slack/etc.) still needs to be added to both files.

Jenkins' declarative stages are strictly sequential no matter what runs in parallel inside them, so the whole Publish
stage always finishes before Deploy starts — GitHub Actions has no such guarantee (a job starts the moment its own
`needs:` are satisfied), so `ci.yml` adds a `publish-complete`
barrier job (`needs:` all four Publish jobs, `if: always()` so it still runs when branch-gating skips some of them,
fails if any of them actually failed) and every `deploy-*` job depends on it alongside `build`. See
`requirements-rules.md` §3.12.

### Emulating CI locally, without Jenkins

`ci-local/` runs the exact same npm commands the `Jenkinsfile` runs, in the same order, as plain POSIX `sh` scripts (no
bashisms — dash/ash-safe, not just bash) — for when you want to reproduce a CI run on your own machine without a Jenkins
instance. One script per branch case, derived directly from the Jenkinsfile's `when` conditions:

```sh
ci-local/run.sh                    # picks the case from the current git branch
ci-local/run.sh some-branch-name   # or pass a branch name explicitly

# ...or run a specific case directly:
ci-local/feature-branch.sh   # Inspection..Package only, nothing branch-gated
ci-local/devel-branch.sh     # + Publish/Snapshot, Deploy/dev, Deploy/test
ci-local/release-branch.sh   # + Deploy/dev, Deploy/test, Deploy/prelive (no Publish - see below)
ci-local/master-branch.sh    # + Publish/Release, Deploy/live, Tag
```

`ci-local/lib.sh` holds the shared stage functions every case script sources; it isn't run directly. Same safety
guarantees as everywhere else: nothing here sets `PUBLISH_EXECUTE=true`, so `npm run publish`
always stays `--dry-run`, and `npm run deploy` always stays
"prepared-not-executed."

One thing worth knowing before picking a case: `release-branch.sh`
faithfully reproduces a real quirk in the Jenkinsfile's own logic, not a bug in the emulation — a `release*` branch name
doesn't match _either_
Publish stage's `when` condition (`Release` needs `branch 'master'`
exactly, `Snapshot` needs `startsWith('devel')`), so real Jenkins runs no Publish stage at all on a release branch, and
neither does this script.

Run any single step for one module only:

```sh
cd packages/a
npm run build
npm test
npm run e2e-test
```

### TypeScript (opt-in per module)

JavaScript is the default; a module opts into TypeScript just by having a
`src/index.ts` instead of `src/index.js` — nothing else has to change, and JS-only modules are completely unaffected.
`@demo/module-b` is the worked example: `src/index.ts`, `test/unit/index.test.ts`, a `tsconfig.json`.

What actually changes when a module opts in:

- `npm run build` (esbuild) transpiles `.ts` the same way it bundles `.js` - esbuild strips types but never type-checks,
  so `dist/index.js` is plain JS either way and downstream modules (`c`, `d`) consuming `@demo/module-b`
  never know or care that it was written in TypeScript.
- `npm run validate` runs `tsc --noEmit` **only if the module has its own
  `tsconfig.json`** and fails validation on a real type error - this is the actual Maven-`compile`-phase-equivalent
  type-check esbuild doesn't give you. Verified by breaking a type on purpose and watching `validate` catch it, then
  restoring it.
- `npm run lint` (ESLint) picks up `.ts` files via `typescript-eslint`, scoped to `**/*.ts` only, so it never touches JS
  modules' config or rules.
- `node --test` runs `.test.ts` files directly (Node 24's native TypeScript type-stripping - no ts-node, no separate
  test-compile step); import specifiers between `.ts` files need the explicit `.ts` extension, same as JS imports
  already need `.js`.

#### Seamless JS/TS coexistence — proven, not just claimed

This isn't a theoretical "should work" — `@demo/module-c` and
`@demo/module-d` are plain JavaScript and both depend on `@demo/module-b`, which is TypeScript, and the full lifecycle
(`build`, `test`,
`integration-test`, `e2e-test`, `site`, `publish` dry-run) runs clean across that mixed graph every time it's been
checked in this repo's history. What actually makes that work, concretely:

- **One workspace graph, one dependency resolution mechanism.** npm workspaces resolves `@demo/module-b` for its JS
  dependents exactly the way it resolves any other workspace package — nothing about the resolution path knows or cares
  what language `b`'s source is in.
- **One build output shape.** Every module's `npm run build` produces the same `dist/index.js` + `dist/index.min.js`
  regardless of source language — a JS module and a TS module are indistinguishable from outside their own `src/`. `c`/
  `d` only ever import
  `@demo/module-b`'s `dist/index.js`.
- **One lint config, one test runner, scoped by file extension, not by a separate pipeline.** `eslint.config.mjs` has a
  `**/*.ts`-scoped block (`typescript-eslint`) alongside the existing `**/*.js`/`**/*.mjs` block in the same file;
  `node --test` picks up `*.test.js` and `*.test.ts`
  side by side in the same phase. There is no "the TypeScript build" as a separate thing to remember to run — it's the
  same `npm run build`/
  `npm run lint`/`npm test` every module uses, and a module's `.ts` files are simply picked up if they exist.
- **The one place TS and JS modules genuinely diverge is `validate`**, and only for a module that opted in:
  `tsc --noEmit` runs if and only if that module has its own `tsconfig.json`. A JS module's `validate` never invokes
  `tsc` at all.

### Adapting the skeleton to other module types (Angular, LESS/CSS, ...)

This repo is a **starter to move real code into**, not just a demo — the
`a`-`d` modules exist to prove the machinery and will be replaced. The extension point for a module that doesn't fit the
default esbuild-`src/index`-to-`dist` shape (an Angular app, a LESS/CSS asset package, a CLI) is deliberately simple:
**every module owns its own
`scripts` block**, and the shared `tools/*.js` are just the defaults those scripts happen to point at. The contract a
module must keep is the _phase names_ (`clean`, `validate`, `build`, `test`, `integration-test`,
`e2e-test`, `package`, ... — the full list in `package.json`), because
`tools/run-workspaces.js` fans out by script name; _what a phase runs_ is the module's own business:

- An **Angular app** module maps its scripts to the Angular CLI:
  `"build": "ng build"`, `"test": "ng test --watch=false"`,
  `"e2e-test": "ng e2e"` (or Playwright/Cypress), keeps `web/`-style serving via `ng serve` behind the same `pre.it.js`/
  `post.it.js` hook files, and skips `tools/build.js` entirely.
- A **LESS/CSS** module points `"build"` at a LESS compile + cssnano minify producing `dist/<name>.css` +
  `dist/<name>.min.css`, and its e2e test serves `web/` with `tools/http-server.js` (which serves
  `text/css` correctly) and asserts on the served stylesheet.
- A module with no meaningful phase keeps the script as a no-op echo rather than deleting it — same rule the CI pipeline
  follows for System/Acceptance.

`tools/validate.js`'s structural checks (`main` → `./dist/index.js`, the
`./min` export) fit the default library shape; a module that diverges should point `"validate"` at its own check script
rather than fighting the shared one. What should NOT be overridden per module: profile names (ADR-0041/0042), the
pre/post cleanup pairing around integration/e2e, and the dry-run-by-default publish/deploy safety rules.

### Build output

Each module build creates both outputs under `packages/<module>/dist`:

- `index.js` - non-minified ESM artifact
- `index.min.js` - minified artifact with legal comments preserved

If a module has a `web/` directory, `npm run build` also copies both artifacts into `web/dist/`, so the same build can
be loaded with a plain
`<script type="module" src="./dist/index.min.js">` tag, in addition to being importable from Node or bundlers (Angular,
etc.) via the package name.

Package tarballs go to `.artifacts/`, deployment descriptors to `.deploy/`, and artifact signatures (SHA-256 for now) to
`.signatures/`. All three are git-ignored, generated output.

### Resources / Profiles (Maven `process-resources` + `-P<profile>` equivalent)

`npm run resources -- --profile <name>` (`tools/resources.js`) copies each module's `resources/` directory into
`dist/resources/`, replacing every
`${propertyName}` token in every file with a value from that profile — text-level substitution, the same as Maven
resource filtering, so it works unchanged in JSON, YAML, XML, `.properties`, `.env`, or plain text. Runs before `build`,
matching Maven's `generate-resources`/`process-resources`
phases preceding `compile`. A module with no `resources/` directory is a no-op.

`--profile` is **required** and validated against exactly six names —
`local`, `dev`, `ci`, `test`, `prelive`, `live` — the canonical environment list from ADR-0041, which ADR-0042 also
mandates as the _only_ allowed build-time/runtime profile names (Maven, Spring, this, or otherwise). Any other value
(`staging`, `prod`, `docker`, ...) is a hard error, not a warning — matching ADR-0042's "reviews must reject
non-canonical profile names" as an actual runtime check instead of a review-time hope.

Property values come from `profiles/<name>.json` at the repo root (one file per canonical environment, shared defaults —
a plain flat JSON object, e.g. `profiles/live.json`), optionally overridden per module by a
`packages/<module>/profiles/<name>.json` file — the same layering a Maven parent POM profile vs. a module's own profile
section gives you. JSON here, not `.properties`: it's the more idiomatic choice for environment config in the Node/JS/TS
world, and every module already has a JSON parser built in — no reason to reach for a Java-flavored format. (The
templates being _filtered_ — `packages/<module>/resources/*` — stay format-agnostic per above; this is specifically
about where the profile's own values live.) See `packages/a/resources/config.json` for a worked example. CI runs use the
`ci` profile (Jenkins/GitHub Actions _are_
the `ci` environment, per ADR-0041); a plain local `npm run build` should be run with `--profile local` first.

### Versioning / changelog

[Changesets](https://github.com/changesets/changesets) manages coordinated multi-module version bumps and changelogs —
Maven's reactor gives you this for free via one parent POM version; npm workspaces doesn't, so each module here versions
independently.

- `npm run changeset` - interactively record which module (s) a change touches and whether it's patch/minor/major;
  writes a
  `.changeset/<name>.md` file, meant to be committed alongside the change it describes (see
  `.changeset/module-a-resources-demo.md` for a real example from this session).
- `npm run changeset:status` - read-only report of what's pending and what it would bump, including cascading
  internal-dependency bumps (e.g. a patch to `@demo/module-a` also patch-bumps `@demo/module-c` and
  `@demo/module-d`, which depend on it transitively). Nothing is applied.
- `npm run changeset:version` - actually applies the pending changesets:
  bumps `package.json` versions, writes `CHANGELOG.md` per module, deletes the consumed `.changeset/*.md` files. Not run
  automatically by either CI file — this is a deliberate step a maintainer runs to prepare a release commit/PR, the same
  way `changeset status` was used here to verify the tool without actually mutating any version numbers.

Changesets only handles _what version, what changelog_ — actually pushing to a registry stays with `npm run publish`
(`tools/publish.js`) above; the two aren't wired together on purpose, so `tools/publish.js`'s own dry-run/branch-tag/
`--ignore-scripts` behavior stays in full control.

### Publish / Deploy (prepared, not wired to a real target yet)

`npm run publish` (`tools/publish.js`) resolves an npm dist-tag from the current branch (`master` -> `latest`,
`release*` -> `release-candidate`,
`devel*` -> `next`, anything else -> skipped) and runs `npm publish` for real, but **always as `--dry-run`** unless
`PUBLISH_EXECUTE=true` is set — nothing in `Jenkinsfile`/`ci.yml` sets it, so CI stays dry-run until someone opts in on
purpose, once there's a real registry to publish to.

One non-obvious thing worth knowing if you ever touch this file: npm treats a script literally named `"publish"` as a
reserved lifecycle hook that `npm publish` runs automatically. Since our own npm-run-publish script is named `publish`
too, `tools/publish.js` **must** call
`npm publish --ignore-scripts`, or it recurses into itself forever.

`npm run deploy` (`tools/deploy.js`) **requires** `DEPLOY_TARGET` to be one of `dev` / `test` / `prelive` / `live` — the
ADR-0041 canonical names, set by the CI files' four parallel Deploy jobs/stages, hard-validated the same way build
profiles are (`local` and `ci` deliberately have no Deploy target, since you don't deploy _to_ a developer machine or
_to_ the build environment itself) — and writes a `.deploy/<module>/<target>/deploy.json`
descriptor with `status: "prepared-not-executed"` — there's no real dev/test/prelive/live infrastructure to deploy to
yet, so this is as far as it goes on purpose. Both scripts are meant to be ready to flip on for real (dist-tag/target
resolution, branch gating, the descriptor shape) without anything actually happening until you say so.

### Test pyramid

- `test/unit/*.test.js` - unit tests against `src/`
- `test/integration/*.test.js` - integration tests against the built
  `dist/index.js`
- `test/e2e/*.test.js` - e2e tests against the built `dist/index.min.js`, **and** against a real running instance

Every module demonstrates the "test against a running solution" pattern (the Node equivalent of `mvn jetty:run` +
failsafe integration tests):
`pre-integration-test`/`pre-e2e-test` start `tools/http-server.js` serving
`web/` on the module's own port (`config.server.port` for manual
`npm run server`; the hook files hardcode a second port so the automated run doesn't collide with a manually-started
server), the e2e tests in
`test/e2e/server.e2e.test.js` make real HTTP requests against it, and
`post-integration-test`/`post-e2e-test` stop the server again. Any module that needs to test against a running process
(an Angular dev build, a local API, ...) can copy the same `config.server` block +
`pre.it.js`/`post.it.js`/`pre.e2e.js`/`post.e2e.js` hook files.

The `tools/*.js` scripts have their own test suite, held to the same unit-vs-integration distinction, split by how a
test exercises the tool:

- `tools/test/unit/*.test.js` - imports and calls an exported function directly, in-process, no subprocess spawned.
  Reserved for pure/ near-pure logic worth regression-testing on its own: `workspace-utils.js`'s topological sort
  (order + circular-dependency detection),
  `site-utils.js`'s `parseLcov`/`escapeHtml`, `profile-utils.js`'s profile validation and layering, `publish.js`'s
  branch → dist-tag mapping. Runs as part of `npm test`.
- `tools/test/integration/*.test.js` - spawns the tool as a real subprocess (`execFileSync`) and observes external side
  effects: files written, an HTTP server actually listening, real fetch responses. This is the `tools/http-server.js`,
  hook-file execution, and
  `tools/resources.js` coverage. Runs as part of `npm run integration-test`, not `npm test` - these aren't fast/isolated
  the way a unit test should be, so they don't belong in the unit-test phase even though they're testing the build
  tooling rather than a module.

A function only gets exported for unit testing if it's genuinely pure (no subprocess, no network, fs is fine if it's
just reading a small fixture file) - `tools/publish.js` and `tools/resources.js` both guard their top-level script
execution so importing them for their exported functions doesn't also run the live script (see the
`fileURLToPath(import.meta.url) === process.argv[1]` guard in
`publish.js`, and `tools/run-tests.js`'s `if (phase)` guard for the existing precedent this follows).

### Site (reports)

`npm run site` generates a static report site per module under
`packages/<module>/site/`, plus an aggregated `site/index.html` at the root linking every module — analogous to a Maven
multi-module `mvn site` run. Each module site links:

- API docs (JSDoc) - `site/docs/`
- Lint report (ESLint, checkstyle-equivalent) - `site/lint/`
- Coverage report (Node's built-in coverage, lcov + HTML) - `site/coverage/`
- Security report (`npm audit`, dependency-check-equivalent) -
  `site/security/`
- Dependency tree (`npm ls --all`, `mvn dependency:tree`-equivalent) -
  `site/dependencies/`
- SBOM (CycloneDX, from `npm run sbom`), if generated

`site/` is generated output and git-ignored.

`ci.yml`'s `release-reports` job (master branch only) is the real
`mvn site-deploy` equivalent: publishes the site to GitHub Pages via
`actions/upload-pages-artifact` + `actions/deploy-pages`. This needs Pages enabled for the repo first (Settings →
Pages → Source: "GitHub Actions") - a repo setting, not something the workflow file can turn on itself.
`devel*` branches don't get this (`snapshot-reports` stays a placeholder):
GitHub Pages serves one site, and every devel branch publishing to the same URL would just overwrite each other without
a per-branch preview path, which isn't wired up. `Jenkinsfile`'s equivalent step also stays a placeholder - there's no
Jenkins-native "push to GitHub Pages" without picking real target credentials, which is a decision to make explicitly,
not guess at.

## Known deliberate differences from Maven

Not everything maps 1:1, and that's expected:

- There's no bytecode-level static analysis; `eslint-plugin-security`
  (wired into the same `npm run lint`, all rules `warn`-severity so a heuristic false positive can't fail the build) is
  the closest SpotBugs/FindBugs analogue - source-level pattern matching (unsafe
  `eval`/regex, non-literal `require`, timing attacks, object injection, ...), not bytecode analysis.
  `detect-non-literal-fs-filename` is disabled outright: every `tools/*.js` script legitimately builds fs paths with
  `path.join()`, which made that one rule fire ~80 times on code that isn't a security problem. The remaining rules
  currently flag 6 warnings, all reviewed and all false positives (local CLI tools indexing objects with
  developer-controlled keys, not attacker-reachable input) - left visible rather than suppressed, the same way you'd
  triage and leave a reviewed-clean SpotBugs finding rather than deleting it.
- `sign` currently produces SHA-256 checksums, not real GPG-style signing.
- `publish`/`deploy` are placeholders — wire real registry/deploy targets when needed.
