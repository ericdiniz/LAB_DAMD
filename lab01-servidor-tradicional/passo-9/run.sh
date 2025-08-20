#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
STAMP="$(date +%s)"
EMAIL="user${STAMP}@test.com"
USERN="testuser${STAMP}"
PASS="123456"

mkdir -p passo-9

# Cabeçalho vazio no início
AUTH_HEADER=()

# Função para request
req() {
  local method="$1"; shift
  local url="$1"; shift
  local out="$1"; shift
  local body="${1-}"
  local tmp="${out}.tmp"
  local status

  if [ -n "$body" ]; then
    if [ ${#AUTH_HEADER[@]} -eq 0 ]; then
      status=$(curl -sS -w "%{http_code}" -o "$tmp" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        --data "$body")
    else
      status=$(curl -sS -w "%{http_code}" -o "$tmp" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "${AUTH_HEADER[@]}" \
        --data "$body")
    fi
  else
    if [ ${#AUTH_HEADER[@]} -eq 0 ]; then
      status=$(curl -sS -w "%{http_code}" -o "$tmp" -X "$method" "$url")
    else
      status=$(curl -sS -w "%{http_code}" -o "$tmp" -X "$method" "$url" \
        -H "${AUTH_HEADER[@]}")
    fi
  fi

  echo "$status" > "${out}.status"
  mv "$tmp" "$out"
  echo "[HTTP $status] $method $url -> $out"
}

echo "[1] Health..."
req GET "${BASE_URL}/health" passo-9/health.json

echo "[2] Registro..."
req POST "${BASE_URL}/api/auth/register" passo-9/register.json \
  "{\"email\":\"${EMAIL}\",\"username\":\"${USERN}\",\"password\":\"${PASS}\",\"firstName\":\"Joao\",\"lastName\":\"Silva\"}"

echo "[3] Login..."
req POST "${BASE_URL}/api/auth/login" passo-9/login.json \
  "{\"identifier\":\"${EMAIL}\",\"password\":\"${PASS}\"}"

# Extrair token
TOKEN=$(node -e "const fs=require('fs');try{const j=JSON.parse(fs.readFileSync('passo-9/login.json','utf8'));console.log((j&&j.data&&j.data.token)||'')}catch(e){console.log('')}")
echo "$TOKEN" > passo-9/token.txt

if [ -z "$TOKEN" ]; then
  echo "ERRO: token vazio. Veja passo-9/login.json e passo-9/login.json.status" >&2
  exit 1
fi

AUTH_HEADER=("Authorization: Bearer ${TOKEN}")

echo "[4] Criar tarefas..."
req POST "${BASE_URL}/api/tasks" passo-9/task-create-1.json \
  '{"title":"T1 - Relatório","description":"Escrever relatório","priority":"high","category":"trabalho","tags":["importante","redacao"]}'

req POST "${BASE_URL}/api/tasks" passo-9/task-create-2.json \
  '{"title":"T2 - Mercado","description":"Comprar frutas","priority":"low","category":"pessoal","tags":"compras,supermercado"}'

req POST "${BASE_URL}/api/tasks" passo-9/task-create-3.json \
  '{"title":"T3 - Estudar","description":"Revisar conteúdo","priority":"medium","category":"estudos","tags":["importante","prova"]}'

echo "[5] Listagens (paginação/filtros)..."
req GET "${BASE_URL}/api/tasks?page=1&limit=2" passo-9/tasks-page1.json
req GET "${BASE_URL}/api/tasks?page=2&limit=2" passo-9/tasks-page2.json
req GET "${BASE_URL}/api/tasks?priority=high" passo-9/tasks-filter-priority-high.json
req GET "${BASE_URL}/api/tasks?category=trabalho" passo-9/tasks-filter-category-trabalho.json
req GET "${BASE_URL}/api/tasks?tag=importante" passo-9/tasks-filter-tag-importante.json

START="$(date -u +'%Y-%m-%d 00:00:00')"
END="$(date -u +'%Y-%m-%d 23:59:59')"

curl -sS -G "${BASE_URL}/api/tasks" -H "${AUTH_HEADER[@]}" \
  --data-urlencode "startDate=${START}" \
  --data-urlencode "endDate=${END}" -o passo-9/tasks-filter-date-today.json
echo "200" > passo-9/tasks-filter-date-today.json.status || true

# headers de rate limit
curl -sS -D passo-9/ratelimit-headers.txt "${BASE_URL}/api/tasks" -H "${AUTH_HEADER[@]}" -o /dev/null

echo "[6] Cache (duas chamadas iguais)..."
req GET "${BASE_URL}/api/tasks?page=1&limit=2" passo-9/cache-call-1.json
req GET "${BASE_URL}/api/tasks?page=1&limit=2" passo-9/cache-call-2.json

echo "[7] CRUD por ID..."
TASK_ID=$(node -e "const fs=require('fs');try{const j=JSON.parse(fs.readFileSync('passo-9/task-create-1.json','utf8'));console.log((j&&j.data&&j.data.id)||'')}catch(e){console.log('')}")
echo "$TASK_ID" > passo-9/task-id.txt

if [ -z "$TASK_ID" ]; then
  echo "ERRO: não consegui extrair TASK_ID. Veja passo-9/task-create-1.json" >&2
  exit 1
fi

req GET "${BASE_URL}/api/tasks/${TASK_ID}" passo-9/task-get-by-id.json

req PUT "${BASE_URL}/api/tasks/${TASK_ID}" passo-9/task-update.json \
  '{"title":"T1 - Relatório (atualizado)","description":"Escrever e revisar","completed":true,"priority":"urgent","category":"trabalho","tags":"importante,entrega"}'

req DELETE "${BASE_URL}/api/tasks/${TASK_ID}" passo-9/task-delete.json

echo "[8] Estatísticas..."
req GET "${BASE_URL}/api/tasks/stats/summary" passo-9/tasks-stats.json

echo
echo "OK! Resultados em ./passo-9 (cada requisição tem .json e .status)."
ls -1 passo-9
