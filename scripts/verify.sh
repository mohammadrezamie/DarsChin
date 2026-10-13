#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

step() {
  printf '\n\n========== %s ==========\n' "$1"
}

fail() {
  local code=$?
  printf '\nFAILED (exit %s): %s\n' "$code" "$CURRENT_STEP" >&2
  exit "$code"
}
trap fail ERR

CURRENT_STEP="environment preflight"
step "$CURRENT_STEP"
node --version
npm --version
test -f package-lock.json || { echo "package-lock.json is required for reproducible verification." >&2; exit 2; }

CURRENT_STEP="clean dependency installation"
step "$CURRENT_STEP"
npm ci

CURRENT_STEP="TypeScript check"
step "$CURRENT_STEP"
npm run lint

CURRENT_STEP="unit and regression tests"
step "$CURRENT_STEP"
npm test

CURRENT_STEP="production build and extension packaging verification"
step "$CURRENT_STEP"
npm run build

CURRENT_STEP="verification summary"
step "$CURRENT_STEP"
echo "PASS: install, TypeScript check, test suite, and production build completed."
echo "Note: this script does not verify live Educationalyar behavior or production deployment."
