#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

npm run clean
rm -rf node_modules packages/*/node_modules
