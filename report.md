# setmy.info-js — review report

Date: 2026-07-17

## Scope

Reviewed and exercised the whole Maven-lifecycle-mapped npm monorepo (`packages/a..d` + `tools/*.js`), running every
lifecycle step end to end on this machine (Linux, Node 24), fixing what was actually broken, closing the gaps flagged as
known-missing (site/docs/coverage reports, a real "test against a running instance" example, a dependency-tree report),
porting the org's `jenkinsfile-starter` into both a `Jenkinsfile` and an equivalent
`.github/workflows/ci.yml`, and preparing (but not wiring live) real publish/deploy behavior. A second round (see "Round
2" below) then worked through the resulting TODO backlog: Maven resource filtering + profiles (ADR-0041/ADR-0042
compliant), extending the running-instance test pattern to every module, an OS/Node CI matrix, TypeScript as a
per-module opt-in, a stricter static-analysis pass, a Changesets version/changelog strategy, and a real GitHub Pages
site-deploy. A third round ("Round 3" below)
re-reviewed everything with the skeleton-for-real-code lens — this repo as a safe, clean starter that existing
Node/browser/TS (later LESS/CSS and Angular) code moves into, with Maven-closeness as a soft rule — fixed what that lens
exposed (including two CI-killing bugs in `ci.yml`), and consolidated all remaining work into one numbered backlog at
the end for step-by-step selection. Full reasoning/trace lives in the conversation; this file is the durable summary
plus the checklist you can point back at.

## Bugs found and fixed

1. **Every orchestration script hardcoded `npm.cmd`** (Windows-only) in
   `execSync`/`execFileSync` calls — `tools/bootstrap.js`, `coverage.js`,
   `install-local.js`, `package.js`, `security.js`, `run-workspaces.js`. On this Linux machine (and on any Linux/macOS
   CI runner) every lifecycle step past `validate` failed immediately with `npm.cmd: command not
found`. This was the main reason "something does not work" — nothing downstream of `run-workspaces.js` could ever run
   outside Windows. Fixed by adding `npmCommand` (`npm` vs `npm.cmd` by platform) to
   `tools/workspace-utils.js` and using it everywhere.
2. **`npm run coverage` silently produced no coverage data.**
   `tools/run-tests.js` built the `node --test` invocation as
   `["--test", ...testFiles, ...extraArgs]` — Node's test runner only honors flags like `--experimental-test-coverage`
   when they precede the file list, so the flag was dropped and coverage never activated (no error, just no report).
   Fixed by reordering to
   `["--test", ...extraArgs, ...testFiles]`.
3. **The tooling's own test suite (`tools/test/*.test.js`, 8 tests covering the http-server tool and the pre/post hook
   mechanism) was never wired into any script** — it only ran if someone happened to invoke
   `node --test tools/test/*.test.js` by hand. Added it to the root `test`
   script so it runs as part of the normal lifecycle.
4. **The "test against a running instance" pattern existed as infrastructure but wasn't actually exercised.**
   `tools/http-server.js` +
   `pre.e2e.js`/`post.e2e.js` already start/stop a server around the e2e phase (the Node equivalent of `mvn jetty:run` +
   failsafe), but module
   `a`'s e2e tests only re-imported the built file directly — never made an HTTP call. Added
   `packages/a/test/e2e/server.e2e.test.js`, which fetches from the live server started by `pre-e2e-test` and asserts on
   the response, and taught `tools/build.js` to publish `dist/index.js` +
   `index.min.js` into `web/dist/` so the page can also load the module via a plain `<script type="module">` tag.
5. **`.gitignore` was missing `.artifacts/`, `.deploy/`, `.signatures/` and the new `site/`** (a `.gitignore.2` draft
   had some of these but was never merged, and doesn't cover `site/`). Merged and removed the stale
   `.gitignore.2` / `README.md.2` drafts (their content is now in the real files).
6. **`npm run lint` never actually covered `tools/`** — only
   `run-workspaces.js` iterating `packages/*` was wired in, so the orchestration scripts themselves had no lint coverage
   at all. Fixed by adding an `eslint tools` step to the root `lint` script. This also surfaced a second issue:
   `eslint.config.mjs` only ignored `**/dist/**`, so once `site/docs` (JSDoc's bundled vendor JS, e.g. `prettify.js`)
   was generated, `eslint .` inside a module started failing on code that was never meant to be linted. Fixed by also
   ignoring `**/site/**`.
7. **`npm run format -- --check` didn't actually check anything — it silently auto-fixed files and exited 0.** The
   `format` script is
   `prettier --write .`; appending `-- --check` produces
   `prettier --write . --check`, and `--write` wins: prettier fixes files in place, reports "issues fixed", and still
   exits 0. This was wired in as the format-check _gate_ in both `Jenkinsfile` and `ci.yml`, so neither ever actually
   blocked a badly formatted commit — proved it by introducing a badly formatted file and watching it get silently
   rewritten (it rewrote `report.md` itself as a side effect of the same bug during testing). Fixed by adding a real
   `format:check` script (`prettier --check .`, no `--write`) and pointing both CI files at it.
8. **`tools/publish.js` would have recursed into itself forever the moment it called `npm publish`.** npm treats a
   script literally named
   `"publish"` as a reserved lifecycle hook that `npm publish` runs automatically — and our own npm-run-publish script
   is named `publish`. So `npm publish` invoked from inside `tools/publish.js` would trigger npm to re-run
   `tools/publish.js`, which calls `npm publish` again, forever. Verified this really happens (ran
   `npm publish --dry-run`
   directly and watched it print `> @demo/module-a@1.0.0 publish` as a side effect), then verified `--ignore-scripts`
   breaks the loop, before wiring
   `tools/publish.js` to actually call `npm publish` for real. This was caught during design, before it ever shipped as
   a working recursive footgun.
9. **The new report tools (`security-report.js`, `dependency-report.js`,
   `lint-report.js`, `docs.js`) used `execFileSync(npmCommand or a
node_modules/.bin path, [...])`.** On Windows, spawning a `.cmd`/`.bat`
   file directly via `execFileSync` (array-args form, not shell-invoked)
   is a known Node/Windows footgun — it typically fails without
   `shell: true`, which is exactly why every _other_ npm invocation in this codebase already used `execSync`
   (shell-invoked, string command) instead. Standardized all four to `execSync` + a new `resolveLocalBin()` helper
   (appends `.cmd` on `win32`, mirroring the existing `npmCommand` pattern)
   for consistency with the rest of the codebase.
10. **`ci.yml`'s multi-line `if:` conditions for `deploy-dev`/
    `deploy-testing` used YAML `|` (literal block), which preserves the line break as a literal `\n` inside the
    expression string.** Switched to `>` (folded block), which collapses it to a single space-joined line — removes any
    doubt about whether GitHub Actions' expression parser tolerates an embedded newline mid-expression. Verified the
    resulting parsed string is a clean one-liner.

## Verified working, end to end

Ran the full sequence from `README.md` (bootstrap → clean → validate → format:check → lint → resources → build → test →
pre/integration/post-integration-test → pre/e2e/post-e2e-test → coverage → security → verify → package → sbom → sign →
site → publish → deploy → changeset:status) with a clean `npm ci`, no errors, on Linux/Node 24 — re-run after every item
in this report, most recently as one combined run after all of "Round 2" below, across the full mixed JS+TypeScript
module graph.

## Added: the "site" (Maven `mvn site` equivalent)

`npm run site` (per module: `npm run site` in `packages/<x>`) generates
`packages/<module>/site/index.html` linking:

- **Docs** — JSDoc HTML from `src/**/*.js` (`tools/docs.js`; added JSDoc comments to module `a` as the example)
- **Lint report** — ESLint findings as an HTML table, non-gating (`tools/lint-report.js`)
- **Coverage report** — Node's built-in coverage, parsed from a real
  `lcov.info` into an HTML table (`tools/coverage-report.js`)
- **Security report** — `npm audit --json` rendered as an HTML table (`tools/security-report.js`)
- **Dependency tree** — `npm ls --all --json` rendered as a nested list, the `mvn dependency:tree` equivalent
  (`tools/dependency-report.js`)

Root `npm run site` runs this for every workspace, then
`tools/aggregate-site.js` writes a root `site/index.html` linking every module's site. No new dependencies except
`jsdoc`.

## Added: CI (Jenkinsfile + GitHub Actions)

`Jenkinsfile` is migrated from the org's `jenkinsfile-starter`: same stage skeleton (Inspection → Preparation → Build →
E2E → Quality → System/Acceptance → Package → Publish → Deploy → Tag), same
`master`/`devel*`/`release*` branch-gated Publish/Deploy pattern with the same `*_TO_*` deploy flags, Maven placeholders
swapped for the real npm scripts. Feature branches run Inspection through Package (full build/lint/test/quality
feedback) but never reach Publish/Deploy/Tag.
`post-integration-test`/`post-e2e-test` run in a stage-level
`post { always { ... } }` block, matching Maven failsafe's guarantee that cleanup runs even when the tests it's cleaning
up after failed.

`.github/workflows/ci.yml` is the same pipeline ported to GitHub Actions:
parallel Jenkins stages become parallel jobs, `when`/`expression` branch gates become `if:` conditions on
`github.ref_name`, the same cleanup guarantee is `if: always()` steps, and a `notify` job (`if: always()`, depends on
every other job) stands in for the Jenkinsfile's
`post { success / failure }` `emailext` steps.

These two files aren't generated from a shared source — a future lifecycle change (new npm script, renamed step) needs
to be applied to both by hand.

## Added: Publish / Deploy (prepared, dry-run only — nothing executes)

Per your instruction to prepare this without actually running it:

- `tools/publish.js` now resolves an npm dist-tag from the branch (`master` → `latest`, `release*` →
  `release-candidate`, `devel*` →
  `next`, anything else → skipped entirely) and runs a real
  `npm publish --tag <tag> --ignore-scripts`, but **always with
  `--dry-run` added** unless `PUBLISH_EXECUTE=true` is set in the environment. Neither CI file sets that variable, so
  both stay dry-run until you explicitly opt in once there's a real registry to publish to. Branch is read from
  `BRANCH_NAME` (Jenkins sets this natively) or
  `CI_BRANCH_NAME` (set explicitly in `ci.yml`'s publish jobs), falling back to `git rev-parse --abbrev-ref HEAD` for a
  plain local run.
- `tools/deploy.js` now reads `DEPLOY_TARGET` (`dev`/`testing`/`prelive`/
  `live`, set by each of the four parallel Deploy jobs/stages in both CI files) and writes
  `.deploy/<module>/<target>/deploy.json` with
  `status: "prepared-not-executed"` — unchanged in spirit from before, just now target-aware instead of every
  branch/target writing to the same file.
- Tested locally end to end (dry-run publish resolving each tag correctly, feature-branch skip, target-aware deploy
  descriptors) — nothing was published or deployed for real anywhere in this process.

When there's an actual registry/target to point at: set `PUBLISH_EXECUTE=true`
(and add real registry auth) and give `tools/deploy.js` a real deployment strategy per target — see TODO below.

## Round 2: implemented from the TODO backlog

Per your instruction to work through the backlog, everything that didn't need credentials/infrastructure I don't have,
or a policy decision that's yours to make, is now implemented and verified end to end (full lifecycle re-run after every
item below, including a combined run of all of them together):

- **Maven resource filtering + profiles** (was the single biggest gap).
  `tools/resources.js` + `tools/profile-utils.js`: `npm run resources --
--profile <name>` filters `${property}` tokens in a module's
  `resources/` directory using `profiles/<name>.properties` (root, with optional per-module override) — text-level
  substitution, works unchanged in JSON/YAML/XML/properties/plain text, same as Maven. Profile names are hard-validated
  against exactly ADR-0041's six canonical environments; anything else is a runtime error, not a lint warning, actually
  enforcing ADR-0042's "reviews must reject non-canonical profile names." Worked example:
  `packages/a/resources/config.json`. Read ADR-0041/ADR-0042 first, as asked, before designing this. 6 tests in
  `tools/test/resources.test.js`.
  - Resolved the naming mismatch this surfaced: `DEPLOY_TARGET`/env flags in both CI files used `testing`, not
    ADR-0041's canonical `test` — renamed throughout (`DEVELOPMENT_TO_TEST`/`RELEASE_TO_TEST`,
    `deploy-test` job/stage). `local` and `ci` deliberately have no Deploy target (you don't deploy _to_ a dev machine
    or _to_ the build environment) — noted, not "fixed," since that's correct as-is.
  - The `-Pe2e`-vs-ADR-0042 tension noted last round is still open — it's a real ambiguity in the ADRs themselves (is
    a build-behavior-switching profile "allowed" or not), not something to resolve unilaterally by editing someone
    else's accepted ADR.
- **Running-instance pattern extended to `b`/`c`/`d`.** Each now has its own `config.server` port, `web/index.html`, the
  four hook files, and
  `test/e2e/server.e2e.test.js` — same pattern as `a`, verified with all four servers running (and stopping) on distinct
  ports in the same lifecycle run without collision.
- **OS/Node matrix.** `ci.yml`'s `build` job now runs
  `{ubuntu-latest, windows-latest} x {node 22, node 24}` (4 combinations,
  `fail-fast: false`); artifact names made matrix-unique. The Windows leg is _structurally_ correct and should work now
  that bug #1 is fixed (cross-platform `execSync`/`.cmd` handling throughout), but genuinely unverified — there's no
  Windows machine in this environment to confirm it against. `Jenkinsfile` got documentation instead of a wired matrix:
  a real Node-version matrix needs Jenkins NodeJS Plugin tool installations and Windows agents configured on your
  Jenkins controller, which is infrastructure this file has no way to see or provision — wiring in a `matrix {}` block I
  can't test against a real Jenkins instance felt worse than documenting the exact steps to add it once that
  infrastructure exists (see the comment at the top of the file).
- **`notify` job cancelled-result gap.** Fixed — now checks
  `contains(needs.*.result, 'cancelled')` too, not just `'failure'`.
- **TypeScript opt-in.** A module opts in just by having `src/index.ts`
  instead of `.js` — `@demo/module-b` is the worked example. Shared tooling (`workspace-utils.js`, `run-tests.js`,
  `eslint.config.mjs`,
  `validate.js`) gained TS-awareness; JS-only modules are unaffected.
  `npm run validate` runs `tsc --noEmit` when a module has its own
  `tsconfig.json` — the real type-check esbuild doesn't give you (esbuild only strips types). Verified by breaking a
  type on purpose and watching
  `validate` catch it. `node --test` runs `.test.ts` directly via Node 24's native type-stripping, no ts-node/build
  step. Full lifecycle re-verified with the mixed JS+TS module graph (`c`/`d` depend on `b`
  and never see or care that it's TypeScript — they only ever consume
  `dist/index.js`, plain JS either way).
- **Stricter static analysis.** `eslint-plugin-security` added, all rules
  `warn`-severity so a heuristic false positive can't fail the build.
  `detect-non-literal-fs-filename` disabled outright — it fired ~80 times on legitimate `path.join()`-built fs calls
  throughout `tools/`, pure noise. The other 13 rules currently flag 6 warnings; reviewed all 6, all false positives
  (local CLI tools indexing objects with developer-controlled keys), left visible rather than suppressed.
- **Version-bump/changelog strategy.** Changesets installed and configured (`baseBranch: master`, matching this repo's
  branch model).
  `npm run changeset` / `changeset:status` / `changeset:version`. Deliberately _not_ wired to actually publish —
  Changesets only owns
  "what version, what changelog"; `tools/publish.js`'s own dry-run/ branch-tag/`--ignore-scripts` logic stays in sole
  control of actually touching a registry. Added one real example changeset (`.changeset/module-a-resources-demo.md`)
  and verified
  `changeset status` correctly cascades the dependency-driven bump through the workspace graph (`a` → `c` → `d`) — did
  not run
  `changeset version` against the real repo, to avoid arbitrary version churn with nothing behind it.
- **Site deploy to GitHub Pages.** `ci.yml`'s `release-reports` job (master only) now really deploys `npm run site`'s
  output via
  `actions/upload-pages-artifact` + `actions/deploy-pages`. Needs GitHub Pages enabled for the repo first (Settings →
  Pages → Source: "GitHub Actions") — a repo setting I can't turn on remotely. `devel*` branches and `Jenkinsfile` both
  keep the `echo` placeholder on purpose: GitHub Pages serves one site, so every devel branch deploying to it would just
  overwrite each other without a per-branch preview path (not built), and Jenkins has no native "push to GitHub Pages"
  without picking real target credentials, which is a decision to make explicitly, not guess.

## Round 3: skeleton-readiness review

Full re-review with a sharpened lens, per your framing: this repo is a **starter that real code will move into**
(Node.js libraries, browser JS, TypeScript; later LESS/CSS assets and Angular apps), and Maven-closeness is a **soft
rule** — same phase names for the context-switching savings, but no hack solutions just to imitate Maven where npm has a
natural way. Re-read for this round: every source/config file excluding
`node_modules`, all `.md` files here, ADR-0041/ADR-0042/ADR-0045, and the
`jenkinsfile-starter` `Jenkinsfile`.

### Relevance verdicts (is this thing relevant or not)

- **Phase layout, tools/, workspaces, test pyramid, ci-local, profiles, site reporting** — relevant, keep; they're
  exactly the machinery real modules will reuse.
- **Modules `a`-`d`** — demo scaffolding; relevant as living proof of the machinery until real modules replace them,
  then deletable one by one.
- **`temp.md`** — no longer relevant; superseded by the updated ADR-0045 npm column. Marked SUPERSEDED at the top (kept
  for history, no longer trusted or updated); README now points at ADR-0045 +
  `requirements-rules.md` instead.
- **`install-local`** — questionable relevance: in an npm-workspaces monorepo, sibling packages are already linked
  automatically, so Maven's
  `install` has no real npm equivalent to imitate — the step currently re-installs a workspace into the root for no
  practical effect. This is exactly the "soft rule" case: kept for phase-name parity for now, but flagged in the backlog
  (item 11) to either repurpose into something genuinely useful (pack-tarball consumer test) or reduce to a documented
  no-op.
- **Hand-rolled SBOM / SHA-256 "sign"** — relevant as clearly-labeled placeholders; already tracked in the backlog.
- **`validate.js`'s fixed `main`/`./min`/`dist` checks** — relevant for the default library shape only; a future
  Angular/CSS module overrides the `validate` script per module (extension mechanism now documented in README, "Adapting
  the skeleton").

### Fixed right away (round 3)

1. **`ci.yml`: all four Deploy jobs and Tag could never run.** GitHub Actions does not expose the `env` context to
   **job-level** `if:`
   conditions — `env.MASTER_TO_LIVE == 'DEPLOY'` at job level silently evaluates false, so `deploy-dev`/`deploy-test`/
   `deploy-prelive`/
   `deploy-live`/`tag` were dead code on every branch. The Jenkinsfile was fine (Groovy `when` reads env normally); the
   port was the bug. Fixed by keeping the branch gate (github context — allowed) at job level and moving the `*_TO_*`
   flag checks down to the deploy step, where the env context is available. This was the most serious find of the round.
2. **`ci.yml`: the Node 22 matrix leg could never pass.** Module `b`'s unit tests are `.test.ts` run directly by
   `node --test`, and native TypeScript type-stripping is default-on only from Node 23.6+ — every Node 22 leg (both
   OSes) would fail at the first TS test. Matrix reduced to Node 24, and `"engines": { "node": ">=24.0.0" }` added to
   the root and all four module `package.json`s so the requirement is declared, not tribal knowledge.
3. **Hard-coded `@demo/` scope in `tools/workspace-utils.js`** — local workspace dependencies (the input to topological
   build ordering) were detected by name prefix. The moment real, non-`@demo` packages move into this skeleton, build
   order would silently degrade to alphabetical. Now detected against the actual set of workspace package names
   (dependencies + devDependencies + peerDependencies), scope-agnostic. This was the single most starter-hostile
   assumption in the codebase.
4. **Dead/broken files removed**: `packages/a/index.js` (stray root entry re-exporting `src/`, bypassing `dist`,
   referenced by nothing) and all four `packages/*/test/index.test.js` (orphaned outside
   `unit/integration/e2e`, so **no phase ever ran them** — and module
   `b`'s still imported `../src/index.js`, which stopped existing when `b`
   went TypeScript: a broken test nothing could catch precisely because nothing ran it).
5. **`DEPLOY_TARGET` is now validated** in `tools/deploy.js` against exactly `dev`/`test`/`prelive`/`live` (ADR-0041),
   hard error otherwise — the same rigor `--profile` already had; previously any string (or nothing, yielding
   `"unspecified"`) was accepted. README's lifecycle sequence updated to `DEPLOY_TARGET=dev npm run deploy`.
6. **`tools/http-server.js` made browser-asset-ready**: the MIME table only knew html/json/js/txt, so a served
   stylesheet came back as
   `application/octet-stream` — which browsers silently refuse to apply. Fatal for the LESS/CSS and Angular future. Now
   serves css/mjs/svg/ png/jpeg/gif/webp/ico/woff/woff2/ttf/xml/map correctly.
7. **`tools/http-server.js` path-boundary hardening**: the directory containment check used bare
   `startsWith(directory)`, which also accepts a _sibling_ directory whose name merely starts with the served one
   (`/srv/web` vs `/srv/web-evil`). Now compares against
   `directory + path.sep`.
8. **`tools/resources.js` prototype-chain edge**: token lookup used
   `key in properties`, so `${constructor}` or `${toString}` would
   "resolve" to a stringified built-in function instead of being reported unresolved. Now `Object.hasOwn`.
9. **Docs**: README gained the explicit "Maven-closeness is a soft rule"
   statement and an "Adapting the skeleton to other module types (Angular, LESS/CSS)" section documenting the extension
   point — per-module `scripts` override with phase names as the only contract;
   `temp.md` marked superseded; ADR-0045 is the maintained table.

Everything re-verified after the fixes: format:check, lint (0 errors; 6 warnings, all reviewed object-injection false
positives — one new from the MIME map, safe because `path.extname()` keys always carry a leading dot and can't collide
with prototype properties), 22 tools unit tests, 14 tools integration tests, all module unit/integration/e2e tests,
resources filtering, build, and both negative and positive `DEPLOY_TARGET`
validation paths.

## Backlog — numbered, pick by number

Consolidates everything still open (previous "Still open" items and new round-3 items). Nothing here blocks using the
skeleton today.

1. **Wire real publish execution** — `tools/publish.js` is ready; needs real registry auth (`.npmrc`/CI secret) and
   `PUBLISH_EXECUTE=true`. Blocked on credentials, not code.
2. **Wire real deploy execution** — `tools/deploy.js` validates targets and writes descriptors; needs actual
   dev/test/prelive/live infrastructure and a per-target strategy.
3. **Real signing** — replace the SHA-256 checksum in `tools/sign.js`
   with GPG/minisign once key material exists.
4. **Gating thresholds policy** — decide whether `verify` should fail below a coverage % or on lint findings (currently
   informational, matching Maven site-report convention). Policy call.
5. **`-Pe2e` vs ADR-0042** — decide whether build-behavior profiles need an ADR carve-out; this repo sidesteps via a
   separate `e2e-test` script.
6. **Windows CI leg verification** — the `windows-latest` matrix leg is structurally correct but has never run on a real
   Windows machine.
7. **Python/Elixir scaffolding** — from `requirements-rules.md`, once this JS layout is declared final.
8. **Lifecycle redundancy optimization** — coverage/site steps re-run tests/lint/audit instead of reusing earlier
   output; optimize only if build time starts to hurt.
9. **Worked example: LESS/CSS module** — a `packages/styles`-type module compiling LESS → `dist/*.css` + minified, own
   `validate`, e2e against the served stylesheet (http-server now serves `text/css` correctly). Proves the "Adapting the
   skeleton" section with running code.
10. **Worked example: Angular app module** — map `ng build`/`ng test`/
    `ng e2e` (or Playwright) onto the phase names per the same override mechanism; proves a framework app coexists with
    library modules.
11. **Decide `install-local`'s fate** — npm workspaces already links siblings, so the current step is a Maven-ism with
    no effect. Either repurpose into a genuinely useful packed-tarball consumer test (install the `npm pack` output into
    a temp project and import it — catches broken `files`/`exports` before publish) or reduce to a documented no-op.
    Recommendation: repurpose.
12. **Site/Pages polish** — root `site/index.html` links relatively into
    `packages/*/site/` (works in the current Pages artifact layout), but the per-module SBOM link points at git-ignored
    `.artifacts/` which is _not_ uploaded with the site: broken once deployed. Copy the SBOM into each module's `site/`
    during site generation; optionally add a root redirect page so the Pages URL doesn't land on a bare directory.
13. **Mutation testing** — wire Stryker (or equivalent) into the Quality stage placeholder both CI files still carry.
14. **Package metadata completeness before real publish** — modules lack
    `repository`, meaningful `description`/`keywords`; `engines` is now done. Worth a pass before item 1 goes live.
15. **Profile value shape** — `profiles/*.json` are treated as flat string maps; a nested object would stringify as
    `[object Object]` in filtered output. Either enforce flatness with a validation error or support dot-path keys.
    Small, but should be deliberate.

## Round 4 review — new findings (append-only)

Fresh review of the restored (end-of-Round-3) state. Nothing was changed in this round — findings only. Numbering
**continues from the backlog above** (1–15), so every pickable item across both lists has one unique number; say the
number and I'll implement it.

16. **`Jenkinsfile`'s `fileExists 'README.md'` check is a no-op.**
    `fileExists` is a Jenkins step that _returns_ a boolean — used as a bare statement (as inherited from
    `jenkinsfile-starter`), the result is discarded and a missing README fails nothing. `ci.yml`'s
    `test -f README.md` equivalent genuinely gates. Fix: wrap it, e.g.
    `if (!fileExists('README.md')) { error('README.md missing') }` — and the same correction is worth feeding back to
    the starter repo itself.
17. **The shared tooling's integration tests are coupled to demo module
    `a`.** `tools/test/integration/http-server.test.js` serves
    `packages/a/web`, reads `packages/a/package.json`'s `config.server`, and asserts on module `a`'s port and
    `web/empty/` fixture. The demo modules are meant to be replaced by real code — the moment `a` is deleted or
    reshaped, the _tools'_ own test suite breaks. Fix: give the tools tests their own fixture directory (temp-created
    workspace, like `lifecycle-hooks.test.js` and `resources.test.js` already do).
18. **`tools/bootstrap.js` is dead code** — nothing references it (the root `bootstrap` script calls `npm ci` directly,
    modules have no bootstrap script). Delete it, or wire it in as the one entry point.
19. **Hardcoded default-library artifact shape in shared tools** —
    `tools/sign.js` signs only `index.js`/`index.min.js`,
    `tools/verify.js` checks only those two, `tools/deploy.js`'s descriptor always claims `dist/index.js` +
    `dist/index.min.js`, and
    `tools/docs.js` runs JSDoc unconditionally on `src/` (errors if a module's `src/` has no JS/TS). Fine for `a`–`d`;
    silently wrong for any future non-default module. (A genericization of these existed briefly and was rolled back
    with the state restore — redoing it is a deliberate choice now, hence a numbered item instead of a fix.)
20. **`install-local` runs nowhere in CI.** README's local sequence includes `npm run install-local`, but `Jenkinsfile`,
    `ci.yml`, and
    `ci-local/*` all skip it. Decide: add it to the Package stage everywhere, or explicitly document it as a
    local-developer-only phase (Maven's `install` is in every CI run by virtue of `mvn deploy`; here it's silently
    absent). Related: backlog 11 (what the phase should even do in an npm-workspaces world).
21. **Security-phase flag inconsistency** — root `security` script runs
    `npm audit` (includes devDependencies), per-module
    `tools/security.js` runs `npm audit --omit=dev`. Same phase name, two different policies; pick one and align both.
22. **`packageManager: "npm@10.9.2"` is stale** — the machine (and Node 24) run npm 11.x, and the field only bites when
    Corepack is enabled, so today it's misleading documentation. Update it (or remove it, or add an npm range to
    `engines`) to match the declared Node 24 baseline.
23. **Published tarballs would ship without license text** — modules declare `"license": "MIT"` but
    `files: ["dist", "README.md"]` and no per-module LICENSE file means `npm pack` output contains no license text (npm
    only auto-includes a LICENSE that sits in the _package_
    root, and the repo-root LICENSE isn't in any package). Add a LICENSE per module (or copy it in during `package`).
    Extends backlog 14.
24. **Root identity is still placeholder** — `node-monorepo-demo`, description "Monorepo Demo", keywords `["Keyword"]`,
    and the
    `@demo/*` scope. The real naming/scope decision has to land before real code moves in, because every module rename
    after that is a breaking change for consumers. Extends backlog 14.
25. ~~**`ci.yml` double-builds in-repo pull requests**~~ — **Resolved in Round 6**: the `pull_request` trigger was
    removed outright (see Round 6 below) rather than deduplicated with a concurrency group, since it was pure
    duplication of what `push: branches: ["**"]` already ran.
26. **`ci-local/` is POSIX-shell-only** — on Windows the emulation scripts need Git Bash/WSL; nothing says so. Either
    document that constraint in README or add PowerShell equivalents if Windows-native developers are expected.
27. **A demo changeset is pending** —
    `.changeset/module-a-resources-demo.md` (created as the Changesets worked example) will bump `module-a` and cascade
    to `c`/`d` on the next `changeset version`. Intentional as a demo; consume it or delete it before real versioning
    starts so the first real release isn't polluted by a demo entry.

## Round 5: `ci.yml` Deploy stage could run before Publish finished

Date: 2026-07-18

Re-checked `Jenkinsfile` execution order/parallelism against `ci.yml` (the concrete trigger: CI runs on GitHub were
observed executing stages out of the order Jenkins gives them). `Jenkinsfile` itself was fine — Jenkins declarative
stages run strictly sequentially no matter what's nested inside them, so Deploy always waits for the whole Publish stage
regardless of what's in its `parallel {}` block. The bug was specific to the GitHub Actions port.

28. **Fixed: three of four `ci.yml` Deploy jobs were missing the Publish-complete barrier dependency.** `deploy-dev`
    correctly had
    `needs: [build, publish-complete]`, but `deploy-test`,
    `deploy-prelive`, and `deploy-live` all had only `needs: build` — the comment directly above them already claimed "`needs: [build,
publish-complete]` on every job below," so this was a partial fix that never got finished, not a deliberate choice. Net
    effect: on
    `devel*`/`release*`/`master` pushes, GitHub Actions' job scheduler could start `deploy-test`/`deploy-prelive`/
    `deploy-live` as soon as
    `build` finished, running them in parallel with (or before)
    `release-publish`/`snapshot-publish`/`release-reports`/
    `snapshot-reports` — the opposite of the Jenkinsfile's guarantee that the whole Publish stage completes before
    Deploy starts. Fixed by adding `publish-complete` to all three jobs' `needs:`, matching
    `deploy-dev`. Verified the resulting YAML parses (`js-yaml`) and all four `deploy-*` jobs now show identical `needs: [build,
publish-complete]`.
    - `ci-local/*.sh` checked too: no equivalent bug possible there, since a POSIX shell script calls `stage_publish`
      then `stage_deploy` in written order — there's no scheduler to race the two stages. No changes made.
    - New rule added, `requirements-rules.md` §3.12: any DAG-based CI tool (job graph, not Jenkins-style sequential
      stages) MUST give every Deploy job a dependency on a Publish-complete barrier job, precisely because a DAG
      scheduler has no concept of "the whole previous stage finished" the way Jenkins does for free.

## Round 6: `ci.yml` silently skipped Deploy/Publish/Tag on pull_request-triggered runs

Date: 2026-07-19

Concrete trigger: a real Jenkins build of this repo's `Jenkinsfile` on the
`develop` branch correctly ran Deploy/dev and Deploy/test, but the GitHub Actions run for the same branch showed both as
skipped. Jenkinsfile logic was fine again — the bug was specific to how `ci.yml` resolves "what branch is this."

29. **Fixed: every branch-name check in `ci.yml` used bare
    `github.ref_name`, which resolves to the wrong value on
    `pull_request`-triggered runs.** This file triggers on both `push:
branches: ["**"]` and `pull_request` (already flagged as a double-build in backlog item 25), so an in-repo PR from
    `develop`
    produces two runs for the same commit: a `push` run, where
    `github.ref_name` really is `"develop"`, and a `pull_request` run, where `github.ref` is the synthetic
    `refs/pull/<N>/merge` ref, so
    `github.ref_name` is something like `"12/merge"` — never matching
    `devel*`/`release*`/`master`. Every `startsWith(github.ref_name,
...)`/`github.ref_name == 'master'` check (Publish's four jobs, Deploy's four jobs' job- and step-level `if:`, Tag, and
    the
    `CI_BRANCH_NAME` passed into `tools/publish.js`) silently evaluated false on that second run, skipping
    Publish/Deploy/Tag even though the PR's actual source branch matched. If a developer happened to look at the PR's
    Checks tab (which surfaces the `pull_request`-triggered run), they'd see Deploy/dev and Deploy/test skipped and
    reasonably conclude CI was broken, even though the sibling `push`-triggered run for the exact same commit ran them
    correctly. Fixed by replacing every
    `github.ref_name` used for branch-gating with `(github.head_ref ||
github.ref_name)` — `github.head_ref` is set only on `pull_request`
    events and holds the real source branch name, `github.ref_name` alone is already correct on `push`, so the `||`
    resolves correctly for both trigger types. Verified all 12 call sites were updated consistently and the resulting
    YAML still parses (`js-yaml`).
    - This does not fix the double-build itself (backlog item 25 stays open) — both runs still happen for an in-repo
      PR — but both now resolve the branch name correctly instead of only the `push` one.
    - `Jenkinsfile` needed no change: Jenkins' multibranch `BRANCH_NAME`
      already reflects the real source branch regardless of how the build was triggered, so this class of bug can't
      occur there.

**Follow-up, same date**: after the `head_ref || ref_name` fix above landed (committed and pushed — verified `HEAD`
matched `origin/develop`), a fresh push to `develop` still showed Deploy/dev and Deploy/test skipped in GitHub Actions.
Every static check available (reading the committed YAML, validating it parses, walking GitHub Actions' documented
default job-gating semantics by hand) said this should already work — but static analysis without access to the actual
run's logs couldn't get further, and guessing wrong again wasn't an acceptable next step. Rather than keep patching
around the `push`/`pull_request` dual-trigger ambiguity (which requires correctly resolving branch name for _two_
different event context shapes, is easy to get subtly wrong, and had already been gotten wrong once), escalated to
removing the ambiguity's source entirely:

30. **`pull_request` trigger removed from `ci.yml` outright**, not just branch-name-patched. `push: branches: ["**"]`
    alone already satisfies rule 3.2 (every branch runs Inspection-through-Package) for a feature/PR branch, so
    `pull_request` was never load-bearing — it only added the double-build (backlog item 25, now resolved) and was the
    root cause of finding 29 above. With `push` as the only trigger,
    `github.ref_name` is unambiguously the real branch on every run, full stop — reverted the
    `github.head_ref || github.ref_name` fallback back to bare `github.ref_name` everywhere, since it's dead weight once
    there's only one trigger to disambiguate.
31. **`deploy-dev`/`deploy-test`/`deploy-prelive`/`deploy-live`/`tag`'s
    `if:` conditions now spell out `needs.<job>.result == 'success'` for each of their direct `needs` explicitly**,
    instead of resting solely on GitHub Actions' implicit default job-gating (a job whose own `if:`
    doesn't call a status-check function is _also_ implicitly required to have every direct `needs` job succeed). That
    implicit rule is documented and was already believed correct — this change doesn't contradict it — but for the one
    guarantee that must never silently regress (Publish finishing before Deploy starts), spelling it out removes any
    dependency on that belief being right, and makes the guarantee visible to a future reviewer instead of implicit.
    - New rules added: `requirements-rules.md` §3.13 (prefer one trigger over several redundant ones), §3.14 (a
      ref-derived branch-name check must not assume the ref means the same thing across every trigger type — superseded
      by §3.13 here, but kept as a rule for a project that has a real reason to keep multiple triggers), §3.15 (spell
      out
      `needs.<job>.result` explicitly for a DAG ordering guarantee that must not regress, rather than resting on
      implicit default gating).
    - Still unverified against a real GitHub Actions run at time of writing (no `gh` CLI / live log access from this
      session) — the next real push to `develop` is the actual confirmation.

## Round 7: `ci.yml` deleted outright

Date: 2026-07-19

Before removal, re-verified Round 5's item 28 fix against the actual committed file and found it had **not** held:
`deploy-dev` still had `needs: [build, publish-complete]`, but `deploy-test`, `deploy-prelive`, and `deploy-live` were
back to `needs: build` only — the same partial-fix shape Round 5 already described once. Whether that was a lost commit
or a re-introduced edit, the practical lesson is the same one §3.12 already exists to guard against: don't trust this
file's own history as proof of the live file's state — re-check the committed YAML directly. Re-applied
`publish-complete` to all three remaining jobs, re-verified with `js-yaml` and `prettier --check`, and confirmed with a
full `./ci-local/run.sh develop` run (separately: this also caught a live `prettier --check` failure on `ci.yml`
itself from the fix's own formatting, fixed with `prettier --write`).

32. **`.github/workflows/ci.yml` deleted outright, not patched further.** Three rounds (3, 5, 6) of DAG-specific bugs
    surfacing after the fact, plus the drift above, was enough signal that incremental patching wasn't converging.
    Deleted the file; `Jenkinsfile` and `ci-local/` are the sole working CI implementation until a GitHub Actions
    rebuild is deliberately scheduled. `README.md`'s CI section and `requirements-rules.md`'s §14 implementation table
    were updated to stop describing `ci.yml` as a present, working file — the rules themselves (§3.12-§3.15) stay, since
    they're general DAG-CI requirements a rebuild must satisfy again, not specific to the deleted YAML.
33. **Corrected an earlier in-session claim about `install-local`.** It was described as a simple oversight ("just wire
    it into the Build/Package stage") without first checking this file — items 11 and 20 above already flag it as a
    deliberately undecided Maven-ism (repurpose into a packed-tarball consumer test, or reduce to a documented no-op),
    not a plain gap to fill. Left unresolved, per the existing recommendation; not fixed this round.

## What more can be done: onboarding `setmy-info-less` and `angular-start-project`

Date: 2026-07-19

Read through the build tooling (root and per-package `package.json`, actual compiler/test invocations, CI files if
any) of two sibling repos that are real, pre-existing candidates to eventually move into this skeleton as new module
types — `/home/has/sources/components/setmy.info/submodules/setmy-info-less` (a LESS/CSS component-library monorepo,
packages `setmy-info-less`, `-enterprise`, `-experimental`, `-extended`, `-fancy`, `-ide`, `-angular-start-project`,
plus a shared `common` package) and `/home/has/sources/components/setmy.info/submodules/angular-start-project` (an
Angular app + library + two LESS style packages). No code moved or copied — read-only investigation, as asked.

### What each project's build actually does

**`setmy-info-less`** (per `packages/setmy-info-less/package.json`):

- Compile: `lessc ./src/main/less/main.less dist/main.css` (plain) and again with `--clean-css` for the minified
  build — two separate invocations, not a single command with a minify flag.
- A Pug-templated HTML demo page per component, built by a hand-rolled `../common/test/js/pugBuild.js` (shared across
  all the LESS-variant packages via the `common` workspace package), served locally by a hand-rolled
  `../common/test/js/server.js` (Express).
- `kss --source src/main/less --destination dist/styleguide --css ../main.css` — a living style guide generated
  straight from LESS comments. This is a real artifact type the current skeleton's Site phase (§8) has no concept
  of.
- Lint: `stylelint` over `**/*.less`, with a `stylelint-less` syntax plugin — this is the module type's actual Lint
  phase (§2 row 5), analogous to `eslint`/`ruff`/`credo` for other languages.
- Test: Jest for unit, a **separate** `jest.e2e.config.js` for e2e, plus both `selenium-webdriver` and a
  `playwright.config.js` present as dependencies/config — two different e2e stacks configured in the same package,
  not consolidated.
- No `validate`, no security/audit script, no SBOM, no sign, no publish/deploy script, no resource/profile filtering,
  and **no checked-in CI pipeline file at all** (no `Jenkinsfile`, no `.github/workflows/*`).

**`angular-start-project`** (per `packages/angular-start-project/package.json` + `angular.json`):

- Build: `ng build --configuration <name>`, and the Angular CLI configurations already defined in `angular.json` are
  named `dev`/`ci`/`test`/`prelive`/`live` — **the exact ADR-0041 canonical six** (`local` maps to `ng serve`/`watch`,
  no separate `local` build configuration needed). This wasn't designed against this skeleton's rules but already
  matches them exactly.
- A `bin/versionModule.js` run as `prebuild` (wired via npm's `prebuild` lifecycle hook, not a separate documented
  phase) stamps version/build metadata into the artifact before `ng build` runs. Nothing in the current npm reference
  implementation's `tools/*.js` does this.
- Test: `ng test` for unit (Angular's own runner), the same separate-Jest-config + Selenium e2e pattern as
  `setmy-info-less` above.
- No lint script at all (no ESLint wired, despite Angular CLI supporting it), no `validate`, no security/audit, no
  SBOM, no sign, no publish/deploy, no resource/profile filtering beyond the build configurations themselves, no CI
  file.
- `angular-start-project-library` (plain JS service layer, deps like `js-api-extend`/`servicejs`/`servedjs`) and
  `angular-start-project-style` (a LESS package) both have `"test": "echo \"Error: no test specified\" && exit 1"` —
  unimplemented placeholders, not even a no-op.
- **Real proof the multi-module-type coexistence goal already works in practice**: `angular-start-project-style`'s
  `package.json` depends on `setmy-info-less-extended@^5.0.0` — an Angular-adjacent LESS package already consumes a
  published package from the other sibling repo. That's the cross-module-type dependency pattern §5.2 requires,
  demonstrated for real, across repos, before this skeleton existed.

### Generic-framework work this suggests (proposals, not done)

1. **A real LESS/CSS module override, built to this exact pattern, not a hypothetical one.** README's "Adapting the
   skeleton" section already sketches a LESS/CSS module in prose; `setmy-info-less` is the concrete spec to build it
   against: `"build"` → `lessc` (plain) + `lessc --clean-css` (minified) as two dist outputs (matches this skeleton's
   own `index.js`/`index.min.js` two-output convention already), `"lint"` → `stylelint` + `stylelint-less`.
2. **Style guide as a new Site-phase artifact type (§8).** `kss`-generated living style guides aren't API docs,
   coverage, security, or dependency-tree reports — the four §8.1 categories don't have a slot for "component style
   guide." Worth an explicit §8.1 addition (or an acknowledged per-module-type Site extension point) rather than
   silently folding it into "API documentation."
3. **A real Angular module override, and it's nearly free.** `README`'s sketch (`"build": "ng build"`) is confirmed
   correct against a real repo, and the configuration-name alignment (§4.1's exact six names, already used by
   `angular.json` unprompted) means the Resources/profile phase (§6) needs essentially no adaptation for an Angular
   module — `ng build --configuration <profile>` already **is** the profile mechanism.
4. **A version-stamping pre-build hook is a real, missing capability.** `bin/versionModule.js`'s job (embed
   version/build metadata into the artifact before compile) has no equivalent anywhere in `tools/*.js`. Worth an
   optional phase or documented hook point, not assumed to be Angular-specific — the same need applies to any module
   type once real publishing starts.
5. **Migrating either project would mean adopting the skeleton's entire CI/quality/publish/deploy layer, not just its
   build step** — neither project has a CI file, a lint gate that isn't stylelint-only, a security scan, SBOM, sign,
   publish, deploy, or profile-filtering today. That's the actual value proposition of moving them in, worth stating
   plainly rather than assuming "wire the build script" is most of the work.
6. **Two redundant e2e stacks (Jest+Selenium and a separate Playwright config) already exist side by side in
   `setmy-info-less`.** The skeleton's uniform `pre-e2e-test`/`e2e-test`/`post-e2e-test` +
   `tools/http-server.js` pattern (already Playwright-free, plain `node --test` + `fetch`) would consolidate this to
   one approach — concrete simplification, not just parity.
7. **Open question, not resolved here**: `setmy-info-less` packages six near-identical LESS theme variants
   (`setmy-info-less`, `-enterprise`, `-experimental`, `-extended`, `-fancy`, `-ide`) sharing one `common` helper
   package. The current skeleton's model is "one module = one fully-scripted package.json" (§5.1) — whether six
   sibling theme variants should each get that full treatment, or whether the skeleton needs a lighter "family of
   modules sharing one build/test script definition" pattern, is a real design decision, not something to default on
   without asking.

### `js-api-extend` → `servicejs` → `servedjs` → {`servedjs-test`, `servedjs-geo`}: a real, already-published dependency chain

Same read-only pass over five more sibling repos — `/home/has/sources/components/setmy.info/submodules/js-api-extend`,
`servicejs`, `servedjs`, `servedjs-test`, `servedjs-geo`. These five are the oldest, most homogeneous family looked at
so far: near-identical `package.json`/`karma.conf.js` (evidently copy-pasted across all five) forming an exact-pinned
dependency chain — `js-api-extend@1.3.4` ← `servicejs` (`"js-api-extend": "1.3.4"`, exact pin) ← `servedjs`
(`"servicejs": "1.2.4"`, exact pin) ← `servedjs-test`/`servedjs-geo` (each `"servedjs": "1.5.5"`, exact pin).

What their build actually does:

- **Build**: a hand-rolled `src/build/index.js` — reads one plain global-script source file
  (`src/main/webapp/js/<name>.js`), minifies it with `uglify-js`, copies raw + minified + an `index.js` shim into
  `dist/`. No bundler, despite `webpack`/`webpack-cli` sitting in every one of the five `devDependencies` blocks —
  grepped `src/` in all five, never invoked by any script. Dead weight, independent of any migration.
- **Test**: Karma + Jasmine against a **real Firefox-headless browser** (not jsdom, not Node's built-in runner) —
  `karma.conf.js` even polyfills `global.Storage = {...}` just to make the source loadable under plain Node at all,
  which is itself evidence the source assumes a real browser environment. Coverage → `target/coverage/` HTML, JUnit
  XML → `target/` — Maven-flavored output paths that predate ADR-0045 by years. The `unit` script (`karma
--single-run`) and `tdd` script (watch mode) are the actual tests; **the `test` script is not a test at all** — it's
  `node src/main/webapp/node/index.js`, a manual `console.log("Value should bee boolean: ", ...)` smoke check with no
  assertion, meant to be eyeballed by a human running it by hand.
- **Release**: an entirely manual, un-gated `release.sh` — `npm install` → `npm audit fix` (silently mutates
  dependency versions) → `npm ci` → `build` → `test` → `unit` → commits `dist/` + `package.json`/`package-lock.json`
  straight to git → merges `develop` into `master` → tags → `npm publish` **for real**, unconditionally, from a
  developer's own machine — no CI run, no branch gate, no dry-run step to inspect first. `dist/` is git-tracked in
  all five repos (not git-ignored).
- No lint tool in any of the five, no CI file in any of the five (no `Jenkinsfile`, no GitHub Actions workflow) — same
  gap as the LESS/Angular repos above. `_config.yml` (Jekyll/GitHub Pages) is present in four of five but missing
  from `servedjs-test` — an inconsistency even within this otherwise-identical family.

What this adds to the proposal list above:

8. **The clearest real-world case yet for Changesets' cascading bump (§13.3, already implemented here).** Bumping
   `js-api-extend` today means manually editing the exact-pinned dependency version in `servicejs`'s `package.json`,
   then `servedjs`'s, then both leaf packages' — by hand, in the right order, across five separate repos. Folding this
   chain into one workspace replaces that with `npm run changeset` + `changeset:version`'s automatic cascading bump —
   exactly the problem §13.3 exists to solve, not a hypothetical one.
9. **`release.sh` is the strongest argument yet for §10's dry-run-by-default rule.** Real, unconditional `npm publish`
   from a developer's machine, `npm audit fix` silently applied and committed moments before release, no CI
   verification, no branch gate. Migrating these in would replace it with the existing
   `tools/publish.js`/`tools/deploy.js` dry-run-unless-`PUBLISH_EXECUTE=true` pattern for free — no new tooling
   needed, just moving in.
10. **`dist/` is git-tracked in all five**, contradicting this skeleton's git-ignored-generated-output convention.
    Migrating means untracking it and trusting the Package phase to regenerate it, same as every module here already
    does.
11. **A real-browser unit-test tier (Karma + Jasmine + Firefox-headless) is a genuinely different tool need than
    anything in `tools/*.js` today**, which only ever runs `node --test` in-process. If a future module's source
    directly touches browser-only APIs in a way jsdom-in-Node can't faithfully exercise (this family's `Storage`
    polyfill is a real example of needing exactly that), that's an open question the skeleton hasn't had to answer
    yet: an optional real-browser unit-test phase, or is jsdom-in-Node always treated as sufficient? Not resolved
    here.
12. **The `test` script lying about what it runs** (a manual eyeball-the-console smoke check, not an assertion-based
    test) is a real-world illustration of exactly why §1.2 ("a phase name MUST mean what a Maven-fluent developer
    expects") matters — this is the concrete failure mode that rule exists to prevent, not an abstract concern.
