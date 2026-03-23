#!/usr/bin/env bash
# Build a distributable archive of greenclaw-agent (no secrets, no dev files)
set -euo pipefail

VERSION=${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")}
DIST_NAME="greenclaw-agent-${VERSION}"
DIST_DIR="/tmp/${DIST_NAME}"
ARCHIVE="${DIST_NAME}.tar.gz"

echo "Building distribution: ${DIST_NAME}"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Export clean copy from git (only tracked files, no .git history)
git archive HEAD | tar -x -C "$DIST_DIR"

# Remove files not needed for distribution
rm -rf "$DIST_DIR"/.claude \
       "$DIST_DIR"/.github \
       "$DIST_DIR"/agent/__tests__ \
       "$DIST_DIR"/vitest.config.ts \
       "$DIST_DIR"/.eslintrc* \
       "$DIST_DIR"/.prettierrc* \
       "$DIST_DIR"/dist.sh

# Verify no secrets leaked
if grep -rqE '(sk-|AKIA|ghp_|gho_|xoxb-)' "$DIST_DIR" 2>/dev/null; then
  echo "ERROR: Potential secrets found in distribution!"
  grep -rnE '(sk-|AKIA|ghp_|gho_|xoxb-)' "$DIST_DIR"
  rm -rf "$DIST_DIR"
  exit 1
fi

# Verify .env is not included
if [ -f "$DIST_DIR/.env" ]; then
  echo "ERROR: .env file found in distribution!"
  rm -rf "$DIST_DIR"
  exit 1
fi

# Build archive
cd /tmp
tar -czf "$ARCHIVE" "$DIST_NAME"
rm -rf "$DIST_DIR"

echo ""
echo "Distribution built: /tmp/${ARCHIVE}"
echo "Size: $(du -h /tmp/${ARCHIVE} | cut -f1)"
echo ""
echo "To install on a server:"
echo "  scp /tmp/${ARCHIVE} user@server:~/"
echo "  ssh user@server 'tar xzf ${ARCHIVE} && cd ${DIST_NAME} && sudo bash install.sh'"
