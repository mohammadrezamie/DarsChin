#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CURRENT_STEP="environment preflight"
step() {
  printf '\n\n========== %s ==========\n' "$1"
}
fail() {
  local code=$?
  printf '\nFAILED (exit %s): %s\n' "$code" "$CURRENT_STEP" >&2
  exit "$code"
}
trap fail ERR

step "$CURRENT_STEP"
command -v bun >/dev/null 2>&1 || {
  echo "Bun is required. Install Bun from https://bun.sh, then rerun: npm run verify" >&2
  exit 2
}
bun --version
test -f bun.lock || { echo "bun.lock is required for reproducible verification." >&2; exit 2; }

CURRENT_STEP="clean frozen dependency installation"
step "$CURRENT_STEP"
bun install --frozen-lockfile

CURRENT_STEP="TypeScript check"
step "$CURRENT_STEP"
bun run lint

CURRENT_STEP="unit and regression tests"
step "$CURRENT_STEP"
export NODE_ENV=test
export JWT_SECRET="${JWT_SECRET:-darschyn-ci-only-secret-not-for-production}"
export MOCK_OTP_CODE="${MOCK_OTP_CODE:-123456}"
bun run test

CURRENT_STEP="production build and extension packaging verification"
step "$CURRENT_STEP"
bun run build

CURRENT_STEP="verification summary"
step "$CURRENT_STEP"
echo "PASS: frozen install, TypeScript check, test suite, and production build completed."
echo "Note: this script does not verify live Educationalyar behavior or production deployment."
