#!/bin/bash

echo "===== 1) LOGIN ====="
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "video@teste.com", "password": "123456"}' | jq -r '.data.token')

echo "Token recebido: $TOKEN"
echo ""

echo "===== 2) LISTAR ITENS ====="
curl -s -X GET "http://localhost:3000/api/items" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

echo "===== 3) CRIAR LISTA ====="
LIST_ID=$(curl -s -X POST http://localhost:3000/api/lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lista do Mercado","description":"Compras da semana"}' | jq -r '.data.id')

echo "Lista criada: $LIST_ID"
echo ""

echo "===== 4) ADICIONAR ITEM (Arroz Integral) ====="
curl -s -X POST http://localhost:3000/api/lists/$LIST_ID/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "86119c90-7ae7-484a-8dc7-957dc17ca342",
    "itemName": "Arroz Integral",
    "quantity": 2,
    "unit": "kg",
    "estimatedPrice": 15.98,
    "notes": "Orgânico"
  }' | jq
echo ""

echo "===== 5) ADICIONAR ITEM (Feijão Preto) ====="
curl -s -X POST http://localhost:3000/api/lists/$LIST_ID/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "4c271f31-9607-469e-b5fb-c84c620f2359",
    "itemName": "Feijão Preto",
    "quantity": 1,
    "unit": "kg",
    "estimatedPrice": 6.49,
    "notes": "Safra nova"
  }' | jq
echo ""

echo "===== 6) VER LISTA COMPLETA ====="
curl -s -X GET http://localhost:3000/api/lists/$LIST_ID \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

echo "===== 7) DASHBOARD ====="
curl -s -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

echo "Fluxo completo executado!"