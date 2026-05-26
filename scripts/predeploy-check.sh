#!/usr/bin/env bash
#
# predeploy-check.sh — run BEFORE `git push origin main` to catch the
# class of errors that have nuked production deploys in the past:
#
#   1. Module not found (wrong relative import path — e.g. ContactButton
#      under ../about/ vs ../). Caused the 25-min /consulting outage on
#      2026-05-26.
#   2. Re-exporting Next.js route-segment config (runtime, alt, etc.)
#      from another file. Caused the /pricing/twitter-image build failure.
#   3. Generic TypeScript errors in source files (we ignore .next/ since
#      those regenerate on next build).
#
# Exit non-zero on any failure. The intent is to wire this to a git
# pre-push hook OR run it manually before `git push`.
#
# Usage:
#   ./scripts/predeploy-check.sh             # check everything
#   ./scripts/predeploy-check.sh dashboard   # only dashboard/ tsc
#
# Required: Node 20+ on PATH (we shell out to the nvm-installed version
# so the dashboard's "engines" >= 20.9.0 requirement is satisfied).
#
set -euo pipefail

# Detect node 20+ (fall back to system node if it's already ≥ 20).
NODE_BIN=""
SYS_NODE_VER=$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1 || echo "0")
if [ "$SYS_NODE_VER" -ge "20" ] 2>/dev/null; then
  NODE_BIN="$(command -v node)"
else
  # Look for a 20+ in nvm
  for candidate in v22.22.1 v20.20.2 v20.17.0; do
    if [ -x "$HOME/.nvm/versions/node/$candidate/bin/node" ]; then
      NODE_BIN="$HOME/.nvm/versions/node/$candidate/bin/node"
      break
    fi
  done
fi
if [ -z "$NODE_BIN" ]; then
  echo "✗ No Node.js >= 20 found. Install Node 20+ or update nvm." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="${1:-all}"

ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "\033[31m✗\033[0m %s\n" "$1" >&2; }
info() { printf "\033[34m→\033[0m %s\n" "$1"; }

failures=0

check_dashboard_tsc() {
  info "Type-checking dashboard/ (TypeScript)..."
  cd "$REPO_ROOT/dashboard"
  # Filter .next/ noise — those errors are stale generated files that
  # get rebuilt by `next build` and don't reflect source-level problems.
  if ! npx --yes tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "\.next/" | tee /tmp/predeploy-tsc.log | grep -q "error TS"; then
    ok "dashboard tsc clean"
  else
    fail "dashboard tsc failed:"
    cat /tmp/predeploy-tsc.log
    failures=$((failures + 1))
  fi
}

check_route_reexports() {
  info "Scanning twitter-image / opengraph-image for forbidden re-exports..."
  cd "$REPO_ROOT/dashboard"
  # Next forbids `export { runtime } from "..."` in route-segment config.
  # The fix is always to declare runtime locally and only re-export the default.
  hits=$(grep -rEn 'export\s*\{\s*[^}]*\b(runtime|alt|size|contentType)\b[^}]*\}\s*from' \
           app/**/twitter-image.* app/**/opengraph-image.* 2>/dev/null || true)
  if [ -z "$hits" ]; then
    ok "no forbidden route-segment re-exports"
  else
    fail "found forbidden re-exports (declare runtime/alt/size/contentType locally instead):"
    echo "$hits"
    failures=$((failures + 1))
  fi
}

# Relative-import resolution is already enforced by `tsc --noEmit` above
# (the /consulting ContactButton bug surfaced precisely as a tsc error in
# Vercel's build log). No need for a redundant filesystem walk.

case "$SCOPE" in
  all)
    check_dashboard_tsc
    check_route_reexports
    ;;
  dashboard)
    check_dashboard_tsc
    ;;
  *)
    echo "Unknown scope: $SCOPE (use 'all' or 'dashboard')" >&2
    exit 2
    ;;
esac

echo
if [ "$failures" -eq 0 ]; then
  printf "\033[32m═══ All pre-deploy checks passed ═══\033[0m\n"
  exit 0
else
  printf "\033[31m═══ %d check(s) failed — DO NOT push yet ═══\033[0m\n" "$failures" >&2
  exit 1
fi
