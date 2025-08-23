#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
OUT="testes-estresse/resultados"
TOKEN=$(cat "$OUT/token.txt")

echo "[seed] criando 3 tarefas..."
for i in 1 2 3; do
  curl -sS -X POST "$BASE/api/tasks" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"title\":\"seed $i\",\"description\":\"seed\",\"priority\":\"medium\"}" >/dev/null || true
done

echo "[wrk] 100 conexões por 10s"
wrk -t4 -c100  -d10s --latency -H "Authorization: Bearer ${TOKEN}" \
  "$BASE/api/tasks?page=1&limit=10" > "$OUT/wrk-100.txt"

echo "[wrk] 500 conexões por 10s"
wrk -t4 -c500  -d10s --latency -H "Authorization: Bearer ${TOKEN}" \
  "$BASE/api/tasks?page=1&limit=10" > "$OUT/wrk-500.txt"

echo "[wrk] 1000 conexões por 10s"
wrk -t4 -c1000 -d10s --latency -H "Authorization: Bearer ${TOKEN}" \
  "$BASE/api/tasks?page=1&limit=10" > "$OUT/wrk-1000.txt"

echo "[burst] forçando rate limit (contando códigos HTTP)"
: > "$OUT/burst-codes.txt"
seq 1 400 | xargs -P 50 -I{} \
  curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer ${TOKEN}" \
  "$BASE/api/tasks?page=1&limit=2" \
  >> "$OUT/burst-codes.txt"

awk '{count[$1]++} END {for (c in count) printf "%s %d\n", c, count[c] | "sort"}' \
  "$OUT/burst-codes.txt" > "$OUT/burst-summary.txt"

echo "OK -> resultados em $OUT (wrk-*.txt, burst-summary.txt)"
