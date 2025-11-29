#!/bin/bash
set -euo pipefail
# Strip extended attributes recursively from built products directory provided by Xcode
# Also remove AppleDouble files (._*) and .DS_Store entries that can break codesign
# Usage in Xcode Run Script phase (before Code Sign):
# "${PROJECT_DIR}/macos/scripts/strip_xattr.sh" "$BUILT_PRODUCTS_DIR"

BUILT_DIR="${1:-}"
if [ -z "$BUILT_DIR" ]; then
  echo "Usage: $0 <BUILT_PRODUCTS_DIR>"
  exit 1
fi

echo "[strip_xattr] Removing extended attributes under: $BUILT_DIR"

if command -v xattr >/dev/null 2>&1; then
  # Clear extended attributes recursively. Use -c (clear) and -r via xattr when available.
  # Use find to iterate to avoid argument list too long.
  find "$BUILT_DIR" -type f -o -type d | while IFS= read -r p; do
    xattr -c "$p" 2>/dev/null || true
  done
  echo "[strip_xattr] xattr cleared"
else
  echo "[strip_xattr] xattr not available on this system"
fi

# Remove AppleDouble files (._*) and .DS_Store that may be present inside bundles
echo "[strip_xattr] Removing AppleDouble files (._*) and .DS_Store under: $BUILT_DIR"
find "$BUILT_DIR" -name '._*' -type f -print0 | xargs -0 rm -f || true
find "$BUILT_DIR" -name '.DS_Store' -type f -print0 | xargs -0 rm -f || true

echo "[strip_xattr] Done"
