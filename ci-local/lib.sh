# Shared step functions, one per Jenkinsfile stage, derived directly from
# ../Jenkinsfile: same npm commands, same order, same guaranteed-cleanup
# pairing (pre-integration-test/integration-test/post-integration-test and
# pre-e2e-test/e2e-test/post-e2e-test) as Jenkins' `post { always { ... } }`
# gives for free. Meant to be sourced by the case scripts in this
# directory (feature-branch.sh, devel-branch.sh, release-branch.sh,
# master-branch.sh), not run directly.
#
# POSIX sh only: no bashisms (no `local`, no `[[ ]]`, no arrays, no
# `set -o pipefail`), so this also runs under dash/ash, not just bash.
#
# The caller must set SCRIPT_DIR (its own directory) before sourcing this
# file - lib.sh cannot reliably locate itself once sourced, $0 still
# refers to the caller.

ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR" || exit 1

step() {
  echo ""
  echo "=== $1 ==="
}

stage_inspection() {
  step "Inspection / Pre-build"
  node --version || return $?
  npm --version || return $?
  test -f README.md || return $?

  step "Inspection / Build tools"
  npm run bootstrap || return $?
}

stage_preparation() {
  step "Preparation"
  npm run clean || return $?
  npm run validate || return $?
}

stage_build() {
  step "Build / Format check"
  npm run format:check || return $?

  step "Build / Lint"
  npm run lint || return $?

  # "ci" is ADR-0041's canonical name for this environment - this script
  # emulates a CI run, so resources get filtered with the ci profile.
  step "Build / Resources (profile: ci)"
  npm run resources -- --profile ci || return $?

  step "Build / Compile"
  npm run build || return $?

  step "Build / Unit tests"
  npm test || return $?

  step "Build / Pre-integration-test"
  npm run pre-integration-test || return $?

  step "Build / Integration tests"
  integration_status=0
  npm run integration-test || integration_status=$?

  # Guaranteed cleanup even if integration-test failed, matching
  # Jenkinsfile's Build-stage `post { always { ... } }`.
  step "Build / Post-integration-test (always)"
  npm run post-integration-test

  return "$integration_status"
}

stage_e2e() {
  step "E2E / Pre-e2e-test"
  npm run pre-e2e-test || return $?

  step "E2E / e2e tests"
  e2e_status=0
  npm run e2e-test || e2e_status=$?

  step "E2E / Post-e2e-test (always)"
  npm run post-e2e-test

  return "$e2e_status"
}

stage_quality() {
  step "Quality / Mutation tests"
  echo 'Put here mutation tests once a JS mutation-testing tool (e.g. Stryker) is wired in'

  step "Quality / Coverage"
  npm run coverage || return $?

  step "Quality / Security"
  npm run security || return $?

  step "Quality / Verify"
  npm run verify || return $?

  step "Quality / Reporting site"
  npm run site || return $?

  step "Quality / Site deploy"
  echo 'Put here site deploy, e.g. publish site/ to an internal reports host'
}

stage_system_acceptance() {
  step "System tests"
  echo 'Put here system tests'

  step "Acceptance tests"
  echo 'Put here acceptance tests'
}

stage_package() {
  step "Package"
  npm run package || return $?
  npm run sbom || return $?
  npm run sign || return $?
}

# $1: "Release" or "Snapshot" (label only, matches the Jenkinsfile stage
# names) - both run the same npm command, BRANCH_NAME (set by the caller)
# is what makes tools/publish.js resolve the right dist-tag.
stage_publish() {
  step "Publish / $1"
  echo "Software $1 publish steps"
  npm run publish || return $?
}

# $1: dev | test | prelive | live - matches Jenkinsfile's Deploy/<target>
# parallel stages exactly, including the DEPLOY_TARGET env var name.
stage_deploy() {
  step "Deploy / $1"
  DEPLOY_TARGET="$1" npm run deploy || return $?
}

stage_tag() {
  step "Tag"
  echo 'Put here tagging steps'
}

# $1: pipeline exit status (0 = success)
notify() {
  step "post always"
  echo "Always"

  if [ "$1" -eq 0 ]; then
    echo "Build SUCCESSFUL - put real notification steps here (e.g. an email/Slack action), same role as Jenkinsfile's emailext success post step."
  else
    echo "Build FAILED - put real notification steps here (e.g. an email/Slack action), same role as Jenkinsfile's emailext failure post step."
  fi
}
