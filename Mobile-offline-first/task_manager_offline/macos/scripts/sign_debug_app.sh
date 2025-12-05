#!/usr/bin/env bash
set -euo pipefail

# Signs the macOS Debug app product with an ad-hoc identity and the DebugProfile entitlements.
# Usage:
#   ./sign_debug_app.sh /path/to/task_manager.app
# If no path is provided, assumes the Flutter debug build output path.

APP_PATH="${1:-build/macos/Build/Products/Debug/task_manager.app}"
ENTITLEMENTS="macos/Runner/DebugProfile.entitlements"

if [ ! -d "$APP_PATH" ]; then
  echo "App bundle not found at: $APP_PATH"
  echo "Run: flutter build macos --debug  (or flutter run -d macos) and provide the path to the built .app"
  exit 2
fi

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "Entitlements file not found at: $ENTITLEMENTS"
  exit 2
fi

echo "Signing app: $APP_PATH"

# Ad-hoc sign with entitlements. The special identity '-' means ad-hoc signing.
codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" "$APP_PATH"

echo "Codesign completed. You can now open the app with open '$APP_PATH' or re-run the app."
exit 0
