#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:3000"
OUT="testes-estresse/resultados"
mkdir -p "$OUT"
echo "[nikto] varrendo $BASE"
nikto -h "$BASE" -o "$OUT/nikto.txt"
echo "[nmap] service/version scan porta 3000"
nmap -A -T4 localhost -p 3000 > "$OUT/nmap.txt"
echo "Relatórios: $OUT/nikto.txt e $OUT/nmap.txt"
