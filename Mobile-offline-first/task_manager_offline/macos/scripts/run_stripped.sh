#!/bin/bash
# Script para limpar atributos estendidos, assinar ad-hoc e abrir o bundle macOS
# Uso: ./macos/scripts/run_stripped.sh [debug|release]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_STRIP="$ROOT_DIR/scripts/strip_xattr.sh"

MODE="debug"
if [ "$#" -ge 1 ]; then
  MODE="$1"
fi

if [ "$MODE" = "release" ]; then
  BUNDLE="$ROOT_DIR/Build/Products/Release/task_manager.app"
else
  BUNDLE="$ROOT_DIR/Build/Products/Debug/task_manager.app"
fi

echo "Bundle alvo: $BUNDLE"

if [ ! -d "$BUNDLE" ]; then
  echo "Bundle não encontrado. Rode 'flutter build macos' primeiro (modo $MODE)." >&2
  exit 1
fi

if [ -x "$SCRIPT_STRIP" ]; then
  echo "Executando strip_xattr.sh..."
  "$SCRIPT_STRIP" "$BUNDLE"
else
  echo "Aviso: $SCRIPT_STRIP não encontrado ou não executável. Tentando limpeza manual..."
  xattr -rc "$BUNDLE" || true
  find "$BUNDLE" -name '._*' -delete || true
  find "$BUNDLE" -name '.DS_Store' -delete || true
fi

echo "Tentando assinatura ad-hoc (teste)..."
codesign -s - --force --deep "$BUNDLE" || true

echo "Verificando assinatura..."
codesign --verify --deep --strict --verbose=2 "$BUNDLE" || true

echo "Abrindo app..."
open -a "$BUNDLE"

echo "Pronto. Veja logs no Console.app ou no terminal que rodou o flutter se usar 'flutter run'."
