#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

npm ci
npm run clean
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm run integration-test
npm run e2e-test
npm run coverage
npm run audit
npm run docs
