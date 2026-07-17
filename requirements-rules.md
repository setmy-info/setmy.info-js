# setmy.info build system — requirements & rules

Status: extracted from the working `setmy.info-js` implementation on
2026-07-17. This document is **language-agnostic on purpose**: it states
what any language/toolchain implementation of this build system must do,
not how the npm implementation happens to do it. Use it as the spec when
building the Python (`setmy.info-python`?) or Elixir (`setmy.info-ex`?)
sibling projects — read it instead of the npm source, and only look at
`setmy.info-js` for a worked reference of one way to satisfy each rule.

Requirement keywords (`MUST`, `MUST NOT`, `SHOULD`, `MAY`) are used in the
RFC 2119 sense: `MUST` is non-negotiable, `SHOULD` is a strong default you
need a real reason to deviate from, `MAY` is a genuine option.

Authoritative external references, do not duplicate their content here —
read them, this document assumes their decisions:

- [ADR-0041](https://setmy-info.github.io/src/site/markdown/it/architecture/decisions/adr-0041-environment-name-conventions.html) —
  canonical environment names.
- [ADR-0042](https://setmy-info.github.io/src/site/markdown/it/architecture/decisions/adr-0042-runtime-and-build-time-profile-name-conventions.html) —
  canonical profile-name rule.
- [ADR-0045](https://setmy-info.github.io/src/site/markdown/it/architecture/decisions/adr-0045-software-build-lifecycles.html) —
  the cross-language phase-mapping table this whole system implements one
  row of.
- **`jenkinsfile-starter`** — the org template §3.7-§3.10 (CI pipeline
  shape) are extracted from. This is the actual origin of the
  Inspection/Preparation/Build/.../Tag stage structure, the
  `<SOURCE>_TO_<TARGET>` deploy-flag naming, and the startup/inspection
  sanity-check pattern (§3.8) — read the file itself, not just this
  document's summary of it, before implementing §3 in a new language:
  - Repo: `git@github.com:setmy-info/jenkinsfile-starter.git` /
    `https://github.com/setmy-info/jenkinsfile-starter` (default branch:
    `master`)
  - Local checkout used for this work:
    `/home/has/sources/components/setmy.info/submodules/jenkinsfile-starter`
  - The template file itself:
    `Jenkinsfile` at the repo root — local path
    `/home/has/sources/components/setmy.info/submodules/jenkinsfile-starter/Jenkinsfile`,
    web URL
    `https://github.com/setmy-info/jenkinsfile-starter/blob/master/Jenkinsfile`.
    `src/Jenkinsfile.groovy` in the same repo is a symlink to the root
    `Jenkinsfile` (same content by construction) — treat the root
    `Jenkinsfile` as canonical.
  - This template repo's own branches (`master`, `develop`,
    `feature/something`, `release/1.0.0`) are themselves a working
    example of the exact branch model §3.1 requires.
  - The npm implementation's own migrated copy — what §3.7-§3.10 actually
    look like once satisfied — is `Jenkinsfile` at the root of
    `setmy.info-js`: local path
    `/home/has/sources/components/setmy.info/submodules/setmy.info-js/Jenkinsfile`,
    repo `git@github.com:setmy-info/setmy.info-js.git` /
    `https://github.com/setmy-info/setmy.info-js`.

## 1. Core principle

1.1. Maven's default build lifecycle is the reference model. Every phase
Maven has a name for (`validate`, `compile`, `test`, `package`, `verify`,
`install`, `deploy`, plus the resource/test-resource generation phases,
plus the separate `site` lifecycle) MUST have a same-named, independently
invokable equivalent in this build system, even if that phase is a no-op
for a given language.

1.2. A developer who knows the Maven phase names MUST be able to guess the
equivalent command in any language implementation without reading
documentation first — same phase name, same relative ordering, same
gating/non-gating behavior. This is the entire point of the system: avoid
context-switching cost between stacks.

1.3. Not everything maps 1:1, and that's expected and acceptable — see
§16 (deliberate divergences). What's not acceptable is silently omitting a
phase or silently renaming it to something Maven-alike-but-different.

## 2. Phase list, order, and gating

In the order they run, `[gate]` = fails the whole build on failure,
`[report]` = generates output but MUST NOT fail the build on findings
(matches Maven's own convention: `checkstyle:check` gates, `checkstyle:
checkstyle` — the report goal — doesn't):

| #   | Phase                                   | Gate/report                                     | Notes                                                                                                                                                       |
| --- | --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bootstrap                               | gate                                            | Reproducible dependency install (`npm ci`-equivalent: lockfile-exact, not "latest matching range").                                                         |
| 2   | Clean                                   | gate                                            | Removes all generated output. MUST be safe to run from a dirty state.                                                                                       |
| 3   | Validate                                | gate                                            | Structural sanity (required files/fields exist) + language type-check if the language has one and the module opted into strict typing (§9).                 |
| 4   | Format check                            | gate                                            | MUST NOT modify files — see §10 rule 10.3, this exact mistake was made and fixed once already.                                                              |
| 5   | Lint                                    | gate                                            | Style/correctness rules.                                                                                                                                    |
| 6   | Resources                               | gate                                            | See §6 — resource filtering. Runs before Compile, same as Maven's `generate-resources`/`process-resources` preceding `compile`.                             |
| 7   | Compile/Build                           | gate                                            | Produces the build artifact(s). MUST NOT perform type-checking if that's already Validate's job (§9) — don't duplicate the gate in two phases.              |
| 8   | Unit test                               | gate                                            | Fast, no I/O, no network, no filesystem beyond source under test.                                                                                           |
| 9   | Pre-integration-test                    | gate, `always()` cleanup paired                 | Starts any process/server integration tests need running.                                                                                                   |
| 10  | Integration test                        | gate                                            | Tests against the _built_ artifact, not source.                                                                                                             |
| 11  | Post-integration-test                   | **`always()`, never skipped**                   | MUST run even if step 10 failed — see §7 rule 7.4.                                                                                                          |
| 12  | Pre-e2e-test / E2E test / Post-e2e-test | same shape as 9-11                              | See §7 rule 7.5 — MUST include at least one test that talks to a _running instance_ over a real protocol (HTTP, etc.), not just re-import the build output. |
| 13  | Coverage                                | report                                          |                                                                                                                                                             |
| 14  | Security                                | report locally, MAY gate in CI on real findings | Dependency vulnerability scan.                                                                                                                              |
| 15  | Verify                                  | gate                                            | Confirms expected artifacts exist/are well-formed.                                                                                                          |
| 16  | Package                                 | gate                                            | Produces the distributable artifact (tarball/wheel/archive/whatever the ecosystem calls it).                                                                |
| 17  | SBOM                                    | report                                          | CycloneDX or an org-approved equivalent.                                                                                                                    |
| 18  | Sign                                    | gate (if enabled)                               | See §11 — currently a checksum placeholder in the npm implementation, not a real signature; don't copy that gap forward without noting it.                  |
| 19  | Install (local)                         | gate                                            | Installs the built artifact into the local toolchain's cache/store for other local projects to consume — Maven's `install`.                                 |
| 20  | Publish                                 | gate, **dry-run by default**                    | See §10.                                                                                                                                                    |
| 21  | Deploy                                  | gate, **prepared-not-executed by default**      | See §10.                                                                                                                                                    |
| 22  | Site                                    | report                                          | Separate from the phases above, same as Maven's separate Site lifecycle — see §8.                                                                           |

## 3. Branching and CI gating

3.1. Branch names in use: `master`, `devel*`, `release*`, and unrestricted
feature branch names (anything else).

3.2. Every branch, including feature branches, MUST run phases 1-19
(everything through Package) on every push. This is the actual point of
the branching model: a developer on a feature branch gets full build/
lint/test/quality feedback without needing a reviewer or a merge first.

3.3. Publish (phase 20), Deploy (phase 21), and any release-tagging step
MUST be gated to `master`/`devel*`/`release*` only, and MUST NOT run on
arbitrary feature branches.

3.4. `master` builds MUST use the `release` dist-tag/channel semantics;
`devel*` builds MUST use a `snapshot`/pre-release channel; `release*`
builds MUST use a `release-candidate`-equivalent channel. See the npm
implementation's `tools/publish.js` branch → dist-tag mapping for the
exact string choices; a Python/Elixir implementation MAY choose different
channel names but MUST preserve the three-way distinction.

3.5. Deploy MUST be gated per-target by both branch pattern AND an
explicit per-target boolean flag (the npm implementation calls these
`<SOURCE>_TO_<TARGET>` env vars, e.g. `RELEASE_TO_PRELIVE`) — a target
being reachable from a branch pattern is necessary but not sufficient; the
flag lets a target be turned off without changing branch logic.

3.6. A CI system that supports guaranteed post-failure cleanup steps
(Jenkins declarative `post { always { ... } }`, GitHub Actions
`if: always()`, or equivalent) MUST use that mechanism for phases 11 and
the E2E equivalent — see rule 7.4. A CI system without that mechanism MUST
NOT be used for this pipeline without first solving that gap some other
way (e.g. `trap` in a shell script).

3.7. **A checked-in CI pipeline definition file MUST exist** (a
`Jenkinsfile`, a GitHub Actions workflow YAML, or the equivalent for
whatever CI tool is in use) that actually encodes the phase sequence from
§2 as real CI stages/jobs — not just a documented sequence of commands a
developer is trusted to run by hand. Without a checked-in definition,
§1.2's promise (a developer trusts the same commands run automatically on
every push) doesn't hold; it's just documentation.

3.8. The pipeline definition MUST open with a startup/inspection step,
run before anything else, that verifies the build environment itself is
usable — the toolchain's version-check commands succeed and a handful of
required repo files exist — and MUST fail loudly and immediately if it
isn't, rather than letting a missing/broken toolchain surface later as a
confusing failure three phases in. (Origin: the org's `jenkinsfile-starter`
template's own "Pre-build" stage — `node --version`, `npm --version`,
`fileExists 'README.md'` in the npm implementation — this is a real
requirement inherited from that template, not an npm-specific nicety, and
was previously missing from this document even though the working
`Jenkinsfile`/`ci.yml` both already do it.)

3.9. The pipeline definition SHOULD group phases into named stages
mirroring this shape (stage _names_ MAY differ per CI tool's conventions,
the _structure_ MUST hold, and this is the structure both the npm
`Jenkinsfile` and `ci.yml` actually use): Inspection (§3.8, run in
parallel with build-tool bootstrap) → Preparation → Build (phases 3-11:
Validate through Post-integration-test) → the E2E test tier → Quality
(Coverage/Security/Verify/Site-generation, §2 rows 13-17, §8) →
System/Acceptance (a placeholder stage is acceptable for test tiers this
repo doesn't implement yet, e.g. no system/acceptance tests exist — an
empty/placeholder stage is fine, a _missing_ one silently drops the
concept) → Package → the branch-gated Publish and Deploy stages (§3.3) →,
`master` only, Tag.

3.10. The pipeline definition MUST end with a completion notification
step that distinguishes at least success from failure (and SHOULD
distinguish cancelled from failure too — see the npm implementation's
`ci.yml` `notify` job for the exact gap of checking failure-only and not
cancelled, found and fixed once already) — this MAY be a placeholder
(e.g. an `echo`) until real notification infrastructure (email/Slack/etc.)
exists, but the step itself, and the success/failure branching, MUST be
present, not silently absent.

3.11. A set of local emulation scripts SHOULD exist, one per branch case
from §3.1 (a "feature/other" catch-all, `devel*`, `release*`, `master`),
that run the exact same commands the CI pipeline definition (§3.7) runs,
in the same order, with the same branch-gating outcome for that case —
so a developer can reproduce a CI run on their own machine without the CI
tool itself installed. These MUST derive their branch-gating logic from
the actual pipeline definition's conditions, not be a separate
hand-maintained copy that can drift from what CI actually does — treat a
mismatch between an emulation script and the pipeline definition as a bug
in the emulation script. Use the ecosystem's most portable scripting
option available (a POSIX shell script needs nothing installed beyond a
shell; reach for something more powerful only if the pipeline definition
itself needs logic a POSIX shell script genuinely can't express).
(Reference: `ci-local/*.sh` in the npm implementation — POSIX `sh`, one
script per case plus a dispatcher that picks a case from a branch name.)

## 4. Environments and profiles (ADR-0041 / ADR-0042)

4.1. The only valid environment/profile names, anywhere in this system —
build-time profiles, runtime profiles, deploy targets, resource-filtering
profiles — are exactly: `local`, `dev`, `ci`, `test`, `prelive`, `live`.
No other name (`staging`, `prod`, `docker`, `k8s`, `debug`,
`customer-x`, ...) is valid. This is not a style preference, it's
ADR-0042.

4.2. A profile name MUST be validated against that list at the point
it's consumed (not just documented as a convention) — an invalid profile
name MUST be a hard error with the list of valid names in the message,
not a silent fallback or a warning. (This is what "reviews must reject
non-canonical profile names" in ADR-0042 becomes as an actual runtime
check instead of a hope.)

4.3. `local` and `ci` MUST NOT have their own Deploy targets — you do not
deploy _to_ a developer's machine or _to_ the build environment itself.
Deploy targets are exactly the environments something real gets deployed
to: `dev`, `test`, `prelive`, `live`.

4.4. `ci` builds (i.e., the build system running inside the actual CI
tool) MUST use the `ci` profile for resource filtering (§6) and any other
profile-driven behavior — the CI tool _is_ the `ci` environment per
ADR-0041, this isn't a separate choice to make per-pipeline.

4.5. Open question, not resolved by this implementation, flag it rather
than silently picking an answer: whether a profile used purely to switch
_build behavior_ (e.g. Maven's conventional `-Pe2e` switching which test
files failsafe scans for) is compatible with ADR-0042's "profiles =
environments only, no feature-state profiles" rule. The npm
implementation sidesteps this by making e2e its own npm script rather
than an npm-side "profile," but if a language's tooling doesn't offer an
equivalent non-profile mechanism, this needs an explicit ADR decision, not
a silent exception.

## 5. Module/workspace layout

5.1. Each module is a standalone unit (own manifest, own tests, own build
output) even when multiple modules live in one repository — the pattern
MUST generalize to modules that are libraries, browser/frontend bundles,
or full framework applications living side by side, not just "libraries
that happen to share a repo."

5.2. Inter-module dependencies within the repo MUST be resolved by the
same mechanism the ecosystem's package manager already uses for
dependencies in general (npm workspaces `file:`/workspace protocol,
Python's equivalent editable/path installs, Elixir umbrella apps or path
deps) — do not invent a bespoke resolution mechanism.

5.3. Given a dependency graph between modules, every lifecycle phase that
needs to run across all modules (build, test, etc.) MUST run in
topological order (dependencies before dependents) for forward phases,
and MAY reverse that order for phases where it matters (the npm
implementation reverses order for `clean`). A circular dependency between
modules MUST be a hard error at the point topological order is computed,
not a silent infinite loop or arbitrary order.

## 6. Resource filtering (Maven `process-resources` equivalent)

6.1. A module MAY have a resources directory (conventionally named
`resources/`) containing template files. If present, a dedicated phase
(§2 row 6) MUST copy that directory into the build output, replacing
every `${propertyName}`-style token in every file with a value resolved
from the active profile.

6.2. Token substitution MUST be **format-agnostic, text-level**
substitution — it MUST work unmodified on JSON, YAML, XML, `.properties`,
`.env`, or plain text, the same way Maven resource filtering does. Do not
build a format-aware templating system; that's solving a different,
harder problem this doesn't need.

6.3. Property values MUST come from a per-environment source keyed by
exactly the ADR-0041 six names (§4.1), e.g. one config file per
environment, in whatever format is most idiomatic for the ecosystem (the
npm implementation uses one flat JSON object per environment — see §14 —
specifically because JSON, not `.properties`, is the natural choice in
the Node/JS/TS world; a Python implementation might reach for a `.toml`
or `.json` file just as naturally, an Elixir one for a `.exs`/`.json`
config — the _format_ is an ecosystem choice, the _one-file-per-canonical-
environment_ structure is not). A module MAY override/extend the shared
values with its own per-module, per-environment values — shared value
wins only where the module doesn't override it (later/more-specific
source wins per key, not per file).

6.4. A token with no resolvable property value MUST NOT silently vanish
or crash the build — leave the literal `${...}` token in the output and
emit a warning naming the file and the unresolved key. (Silently
vanishing produces a corrupted-looking artifact that's hard to
root-cause; crashing the whole build over one unresolved dev/test-only
property is disproportionate — a warning is the right severity.)

6.5. A module with no resources directory MUST be a silent no-op for this
phase, not an error.

## 7. Test pyramid

7.1. Three test tiers, each in their own conventionally-named directory
per module: unit (against source), integration (against the _built_
artifact), e2e (against the built, _packaged/minified_ artifact, plus
rule 7.5).

7.2. Unit tests MUST run against source directly (fastest feedback,
catches source-level bugs before a build step could mask or introduce
new ones).

7.3. Integration and e2e tests MUST run against the actual build output,
not source — they exist specifically to catch bugs the build/bundle/
packaging step itself could introduce that unit tests against source
would never see.

7.4. **Any process started for integration or e2e testing (a server, a
container, a background service) MUST be stopped by a paired "post" step
that runs even if the tests themselves failed.** This is not optional —
it's the exact guarantee Maven's failsafe plugin gives for free via
`pre-integration-test`/`integration-test`/`post-integration-test`, and
losing it means a single failing test leaks a process on every CI run
until someone notices. See §3.6 for how to get this from your CI tool.

7.5. **At least one e2e test per module that has a running-instance
capability (§7.6) MUST make a real request (HTTP or whatever the module's
protocol is) against the instance started by the pre-e2e-test step** —
not just re-import/re-invoke the built code in-process. This is the
actual "test against a running solution" pattern (Maven's conventional
`mvn jetty:run` + failsafe), and it is easy to build the start/stop
machinery (§7.4) and never actually exercise it this way, which defeats
the point. (This exact gap existed in the npm implementation until it was
found and fixed — the server start/stop machinery existed and worked, but
nothing was actually calling the running server.)

7.6. A module's running-instance capability (if it has a servable
component — a web frontend, a local API, a dev server) MUST be
independently configurable: its own port/address, independent of any
other module's, so multiple modules' instances can run simultaneously
without collision (e.g. during a full-repo test run across all modules in
sequence or in parallel).

7.7. **This same unit-vs-integration classification applies to the build
tooling's own test suite (the tests that test `tools/*` /
`scripts/*`/whatever your build orchestration code is called, not the
modules being built), and it's easy to get wrong by classifying a test
based on _what_ it tests rather than _how_ it tests it.** A test that
imports and calls an exported function directly, in-process, is a unit
test — it belongs in the fast, no-I/O-beyond-a-fixture-file tier
regardless of whether the function under test happens to belong to a
"build tool" or a "product module." A test that spawns the tool as a real
subprocess and observes external side effects (files written, a real
server listening, a real network response) is an integration test, full
stop, even though it's still "testing the build tooling" — it MUST NOT
be lumped into the fast unit-test phase just because of what it's
labeled as testing. (This was a real classification bug in the npm
implementation: `tools/test/*.test.js` — all of it subprocess-spawning,
real-server, real-fs — was wired into the unit-test phase. Fixed by
splitting into `tools/test/unit/` (direct function calls only) and
`tools/test/integration/` (subprocess-spawning), and — since some of the
useful pure logic lived inside a script that also had top-level
side-effecting code — extracting and exporting that pure logic with the
script's execution guarded behind an entry-point check, so importing it
for the unit test doesn't also run the live script. See
`tools/publish.js`'s `resolveDistTag`/`resolveBranch` as the worked
example of both the extraction and the guard.)

## 8. Site / reporting (Maven's separate Site lifecycle)

8.1. "Site" is a distinct concept from the default build lifecycle
(§1-3) — same as Maven, where `mvn site` is a separate lifecycle, not
part of `mvn verify`/`install`/`deploy`. A "site" phase/command MUST
exist and MUST aggregate, per module and across the whole repo:

- API documentation generated from source-level doc comments.
- A lint report (human-browsable, not just console output) — the
  checkstyle-report equivalent.
- A coverage report (human-browsable, ideally with per-file breakdown).
- A security/dependency-vulnerability report — the OWASP
  dependency-check-report equivalent.
- A dependency tree report — the `mvn dependency:tree` equivalent.
- Links to the SBOM if one was generated.

8.2. Every report in §8.1 MUST be non-gating — generating the site MUST
NOT fail because a report found issues (that's what the gating phases in
§2 are for). The site is Maven's own convention here too: `site` reports
findings, `verify`/`checkstyle:check`/etc. are what block a bad build.

8.3. A repo with multiple modules MUST produce both a per-module site and
one aggregated root site linking every module's site — the reactor-level
`mvn site` page.

8.4. Deploying the generated site somewhere browsable (GitHub Pages or
equivalent) is a separate, explicitly-triggered step, MUST be gated the
same way Deploy (§2 row 21, §3.5) is gated, and MUST NOT be assumed to
work without the hosting target actually being provisioned/enabled first
(a repo setting, DNS, credentials — whatever the target needs) — that
provisioning is out of scope for the build system itself to perform.

## 9. Language typing (opt-in, if the language supports both typed and untyped modes)

9.1. If the language ecosystem has both a dynamically-typed default and
an optionally-stricter typed mode (e.g. JS vs. TypeScript), the untyped
mode MUST remain the default, and a module MUST be able to opt into the
typed mode without requiring any change to modules that don't opt in, and
without requiring changes to the _shared_ tooling's public behavior for
untyped modules (shared tooling MAY need internal changes to become
type-aware, that's expected and fine — see the npm implementation's
`workspace-utils.js` changes as the reference).

9.2. A module that opts into typed mode MUST get a real type-check as
part of a gating phase (Validate, §2 row 3) — if the build/compile step
only strips/transpiles types without checking them (true of esbuild, and
likely true of similar fast-bundler tooling in other ecosystems), the
type-check MUST live somewhere else in the gating sequence, not be
silently absent.

9.3. Downstream modules consuming a typed module's build output MUST NOT
need to know or care that it was written in the typed mode — they only
ever see the same build-output shape any module produces.

9.4. **Typed and untyped modules MUST coexist in the same dependency
graph, resolved by the ecosystem's normal dependency mechanism, with no
separate build pipeline, no separate lint/test invocation, and no manual
step to bridge between them.** This isn't a nice-to-have, it's the actual
point of §9.1-9.3 taken together, and it MUST be demonstrated, not just
asserted: at least one untyped module in the reference implementation
MUST depend on at least one typed module, and the full lifecycle (build,
unit/integration/e2e test, site, publish dry-run) MUST run clean across
that mixed graph. (Reference: `@demo/module-c` and `@demo/module-d` are
JavaScript and both depend on `@demo/module-b`, which is TypeScript — this
is checked, not hypothetical.)

9.5. Lint and test tooling MUST handle both modes from the same
invocation, scoped by file extension (or the ecosystem's equivalent
signal), not by a separate command a developer has to remember to run for
"the TypeScript one." A single `lint`/`test` run over the whole repo MUST
cover every module regardless of which mode each one is in. (Reference:
`eslint.config.mjs` has one config block matched to `**/*.ts` sitting
alongside the existing `**/*.js`/`**/*.mjs` block in the same file, not a
separate `eslint.config.ts.mjs`; `node --test` picks up `*.test.js` and
`*.test.ts` in the same directory scan.)

## 10. Publish and Deploy safety rules

10.1. **Publish MUST default to a dry-run / no-op mode and only perform a
real publish when an explicit, separately-set flag/environment variable
says to.** Neither CI configuration should ever set that flag itself —
it's a deliberate human/one-time opt-in, not something that becomes true
by merging to a particular branch.

10.2. Before wiring a "publish" (or any lifecycle-phase-named) script to
literally invoke your package manager's own publish command: **check
whether your package manager treats that phase name as a reserved
lifecycle hook it will re-invoke automatically.** npm does exactly this
for a script named `publish` — invoking `npm publish` from inside a
script npm calls `publish` recurses forever unless you pass the
equivalent of `--ignore-scripts`. Verify this for whatever package
manager/ecosystem you're implementing in before assuming the analogous
wiring is safe; do not assume npm's specific gotcha translates 1:1, but
do assume _some_ version of "does my package manager auto-invoke a script
with this exact name" needs checking.

10.3. **A "format check" step MUST NOT be implemented as "the same
auto-fix command with a check flag appended"** unless you've verified the
underlying tool's flag-precedence rules don't just silently auto-fix
anyway. `prettier --write . --check` fixes files AND exits 0 — the
`--check` flag loses. This exact bug existed in the npm implementation's
CI format-check gate until it was found (by deliberately introducing a
badly-formatted file and watching it get silently rewritten) and fixed
with a dedicated check-only command. Any language's formatter MUST have
its own dedicated non-mutating check invocation verified to (a) actually
detect a real violation and (b) not modify the file when it does.

10.4. Deploy MUST default to "prepare a descriptor of what would be
deployed, without touching a real target" until real target
infrastructure exists — same "prepared, not executed" philosophy as
publish. The descriptor MUST record at least: package identity, version,
target environment name (one of the ADR-0041 six, §4.3), and a status
field distinguishing "prepared" from "executed."

## 11. Signing and SBOM

11.1. A "sign" phase MUST exist. A checksum (e.g. SHA-256) is an
acceptable **placeholder** implementation but MUST be clearly labeled as
not being a real cryptographic signature — don't let a checksum silently
pass as "signing" in documentation or in a reader's mental model.

11.2. An SBOM phase MUST exist and SHOULD produce CycloneDX (or another
explicitly org-approved standard) — a hand-rolled JSON shape that merely
resembles CycloneDX is an acceptable placeholder (again, clearly labeled)
until a real generator for the target ecosystem is wired in.

## 12. Static analysis / quality-gate philosophy

12.1. A stricter static-analysis pass beyond basic lint (the
SpotBugs/FindBugs-equivalent layer) MUST default to non-gating
(warn-severity or equivalent) — a heuristic security/quality checker's
false positives MUST NOT be able to fail a build. This is a deliberate
choice, not a lowered bar: a gating tool that cries wolf gets disabled or
ignored, which is strictly worse than a non-gating tool that's actually
looked at.

12.2. If a specific rule within such a tool produces overwhelming noise
on legitimate code (verified by actually running it and counting/
reviewing the findings, not assumed), that specific rule MAY be disabled
outright, with the false-positive count/reasoning documented at the point
it's disabled. Don't disable the whole tool over one noisy rule.

12.3. Findings that survive triage and are confirmed false positives
SHOULD stay visible (as warnings) rather than be suppressed — the same
discipline as leaving a reviewed-clean static-analysis finding in place
rather than deleting it, so the next reviewer doesn't have to re-derive
"is this actually fine."

## 13. Versioning and changelog

13.1. Each module MUST be independently versionable — a monorepo of
otherwise-independent modules MUST NOT be forced into one shared version
number just because they share a repository (unless the modules are
genuinely always released together, which none of the reference modules
are).

13.2. A change that touches a module MUST be recordable, at the time the
change is made, as "this module needs a version bump of size X" — this
record MUST be a file/artifact committed alongside the change (not a
mental note or a release-time guess), so the actual version bump and
changelog entry can be generated mechanically later from accumulated
records, not hand-written at release time.

13.3. If module A depends on module B within the repo, a version bump to
B MUST be able to trigger a cascading bump to A automatically (at least
at "patch" severity) — a consumer of a changed dependency needs its own
version bumped even if nothing in the consumer's own source changed.

13.4. The versioning/changelog mechanism (§13.2-13.3) MUST be a separate
concern from actually publishing (§10) — "what version and changelog"
and "push this to a registry" are two different decisions with two
different points of no return, and conflating them removes the ability
to review a version bump before anything gets published.

## 14. npm implementation reference (this row of the ADR-0045 table)

This section is npm-specific and is NOT itself a requirement — it exists
so a Python/Elixir implementer can see one concrete, working answer to
"how do you actually satisfy rule N" without having to read the source.

| Requirement                                     | npm implementation                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2 phases                                       | `package.json` `scripts` block, one entry per phase, `tools/*.js` doing the actual work, `tools/run-workspaces.js` fanning a phase out across all modules in topological order                                                                                                                                                     |
| §3 branch gating, pipeline shape (§3.7-3.10)    | `Jenkinsfile` (Jenkins declarative `when`/`expression`, `Inspection`/`Preparation`/`Build`/.../`Tag` stages, `post { always {} success {} failure {} }`) and `.github/workflows/ci.yml` (`if:` on `github.ref_name`, matching jobs, `notify` job)                                                                                  |
| §3.11 local CI emulation                        | `ci-local/{feature,devel,release,master}-branch.sh` + `ci-local/run.sh` dispatcher + `ci-local/lib.sh` shared stages — POSIX `sh`, branch-gating logic read directly off `Jenkinsfile`'s `when` conditions                                                                                                                         |
| §4 profiles                                     | `tools/profile-utils.js` (`CANONICAL_PROFILES`, hard-validated), `profiles/<name>.json` (flat JSON object, not `.properties` — see §6.3)                                                                                                                                                                                           |
| §5 modules                                      | npm workspaces (`packages/*`), `tools/workspace-utils.js`                                                                                                                                                                                                                                                                          |
| §6 resources                                    | `tools/resources.js`, `${propertyName}` regex substitution                                                                                                                                                                                                                                                                         |
| §7 test pyramid, §7.7 unit-vs-integration split | Node's built-in `node --test`, `test/{unit,integration,e2e}/` per module, `tools/http-server.js` + `pre.it.js`/`post.it.js`/`pre.e2e.js`/`post.e2e.js` hook files per module; the build tooling's own tests split the same way into `tools/test/unit/` (direct function calls) and `tools/test/integration/` (subprocess-spawning) |
| §8 site                                         | `tools/site.js`, `tools/docs.js` (JSDoc), `tools/lint-report.js`, `tools/coverage-report.js`, `tools/security-report.js`, `tools/dependency-report.js`, `tools/aggregate-site.js`                                                                                                                                                  |
| §9 typing, §9.4-9.5 coexistence                 | TypeScript, opt-in via `src/index.ts`, `tsc --noEmit` in `tools/validate.js`, `typescript-eslint` scoped to `**/*.ts` in the same `eslint.config.mjs`; `@demo/module-c`/`@demo/module-d` (JS) depending on `@demo/module-b` (TS) is the checked coexistence proof                                                                  |
| §10 publish/deploy                              | `tools/publish.js` (`--dry-run` unless `PUBLISH_EXECUTE=true`), `tools/deploy.js` (`DEPLOY_TARGET` env, writes `.deploy/<module>/<target>/deploy.json`)                                                                                                                                                                            |
| §11 sign/SBOM                                   | `tools/sign.js` (SHA-256 placeholder), `tools/package.js --sbom` (hand-rolled CycloneDX-shaped JSON)                                                                                                                                                                                                                               |
| §12 static analysis                             | `eslint-plugin-security`, all rules `warn`, `detect-non-literal-fs-filename` disabled                                                                                                                                                                                                                                              |
| §13 versioning                                  | [Changesets](https://github.com/changesets/changesets)                                                                                                                                                                                                                                                                             |

## 15. Open items (not resolved here — resolve explicitly, don't inherit silently)

- §4.5: is a build-behavior-switching profile (Maven's conventional
  `-Pe2e`) compatible with ADR-0042, or does it need its own ADR
  carve-out?
- Real publish (§10.1) and real deploy (§10.4) execution: blocked on
  actual registry credentials and actual target infrastructure existing,
  not a design question.
- Gating thresholds (§12 doesn't mandate one): should `verify` fail below
  a coverage percentage, or on any lint error? This is a policy decision
  per-repo/per-org, not something this document should answer for you.
- Real cryptographic signing (§11.1): needs key material before it can
  stop being a placeholder.

## 16. Known deliberate divergences (acceptable, must be labeled)

Referenced from §1.3: not everything maps 1:1 to Maven, and that's fine
as long as the gap is documented at the point it exists, not silently
absorbed. Known ones so far:

- No bytecode-level static analysis (there's no equivalent concept in a
  language that doesn't compile to a shared bytecode format) — §12's
  source-level heuristic pass is the closest available analogue, not a
  replacement.
- Sign (§11.1) is a checksum, not a real signature, until key material
  exists.
- SBOM (§11.2) MAY be a hand-rolled CycloneDX-shaped document rather than
  output from a real CycloneDX generator, until one exists for the target
  ecosystem.
- Publish/Deploy (§10) stay in "prepared, not executed" mode until real
  registry credentials / target infrastructure exist — this is a
  divergence from "fully working" but not from the spec itself, which
  requires exactly this default.

A new divergence discovered while implementing a language port MUST be
added to this list, not left implicit in code comments only.
