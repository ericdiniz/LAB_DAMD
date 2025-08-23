#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
OUT="testes-estresse/resultados"
mkdir -p "$OUT"

STAMP=$(date +%s)
EMAIL="stress${STAMP}@test.com"
USERN="stress${STAMP}"
PASS="123456"

echo "[prepare] registrando..."
curl -sS -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"username\":\"$USERN\",\"password\":\"$PASS\",\"firstName\":\"Stress\",\"lastName\":\"User\"}" \
  > "$OUT/register.json" || true

echo "[prepare] login..."
curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  > "$OUT/login.json"

TOKEN=$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(j?.data?.token||'')" "$OUT/login.json")
if [ -z "${TOKEN}" ]; then echo "ERRO: TOKEN vazio. Veja $OUT/login.json" >&2; exit 1; fi
echo "$TOKEN" > "$OUT/token.txt"
echo "[prepare] TOKEN salvo em $OUT/token.txt"
