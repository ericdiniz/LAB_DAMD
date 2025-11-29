#!/usr/bin/env bash
set -euo pipefail

# Script helper para inspecionar e limpar bundles macOS gerados pelo Flutter/Xcode
# Uso: ./macos/scripts/check_and_strip_release.sh
# O script procura por bundles Debug/Release, lista xattr e AppleDouble,
# remove atributos e AppleDouble, roda codesign --verify e reporta status.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

APP_DEBUG=build/macos/Build/Products/Debug/task_manager.app
APP_RELEASE=build/macos/Build/Products/Release/task_manager.app

check_and_print() {
  local app_path="$1"
  if [ ! -d "$app_path" ]; then
    echo "[check] bundle não encontrado: $app_path"
    return 1
  fi

  echo "[check] Inspecionando bundle: $app_path"
  echo "-- primeiros xattr (se houver) --"
  xattr -lr "$app_path" 2>/dev/null | sed -n '1,200p' || echo "(nenhum xattr listado)"
  echo "-- arquivos AppleDouble (. _*) --"
  find "$app_path" -name '._*' -print | sed -n '1,200p' || echo "(nenhum AppleDouble encontrado)"
  echo "-- .DS_Store --"
  find "$app_path" -name '.DS_Store' -print | sed -n '1,200p' || echo "(nenhum .DS_Store encontrado)"

  echo "[check] Limpando xattr e removendo AppleDouble/.DS_Store no bundle..."
  if command -v xattr >/dev/null 2>&1; then
    find "$app_path" -type f -o -type d | while IFS= read -r p; do
      xattr -c "$p" 2>/dev/null || true
    done
  fi

  find "$app_path" -name '._*' -print0 | xargs -0 rm -f || true
  find "$app_path" -name '.DS_Store' -print0 | xargs -0 rm -f || true

  echo "[check] Rodando codesign --verify (detalhado)"
  codesign --verify --deep --strict --verbose=2 "$app_path" || true

  echo "[check] Tentando assinatura ad-hoc (para diagnóstico)"
  codesign -s - --deep --force --verify --verbose=2 "$app_path" || true

  echo "[check] FIM da inspeção para: $app_path"
  return 0
}

STATUS=1

if [ -d "$APP_DEBUG" ]; then
  check_and_print "$APP_DEBUG" && STATUS=0 || STATUS=1
fi

if [ -d "$APP_RELEASE" ]; then
  check_and_print "$APP_RELEASE" && STATUS=0 || STATUS=1
fi

if [ "$STATUS" -ne 0 ]; then
  echo "[check] Nenhum bundle encontrado ou problemas detectados. Se nenhum bundle existir, rode 'flutter build macos' primeiro."
fi

exit $STATUS
