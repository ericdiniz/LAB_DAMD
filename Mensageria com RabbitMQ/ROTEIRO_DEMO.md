# Roteiro da Demonstração RabbitMQ

> Use este passo a passo para gravar o vídeo de validação.

## 1. Pré-requisitos

- Docker Desktop em execução
- Portas livres: `3003`, `5672`, `15672`
- Terminal aberto em `Mensageria com RabbitMQ`

## 2. Instalação de dependências (uma vez por máquina)

> Objetivo: garantir que as dependências compartilhadas e específicas do List Service estejam instaladas.

```bash
cd "Mensageria com RabbitMQ"
npm install
cd services/list-service
npm install
cd ../..
```

Saídas esperadas:

- `added X packages` ou `up to date` no primeiro `npm install`.
- `added X packages` ou `up to date` no segundo `npm install`.

Esse projeto só precisa dessas duas instalações porque os workers usam as libs da raiz e o serviço HTTP mantém seu `package.json` próprio.

## 3. Limpar artefatos anteriores (opcional)

```bash
pkill -f "workers/notification-worker.js" || true
pkill -f "workers/analytics-worker.js" || true
pkill -f "services/list-service/server.js" || true
docker stop rabbit || true
```

## 4. Iniciar o ambiente

### Terminal A – Broker RabbitMQ

```bash
cd "Mensageria com RabbitMQ"
docker start rabbit
```

Opcional: acessar `http://localhost:15672` (guest/guest) e mostrar filas zeradas.

### Terminal B – List Service (Producer)

```bash
cd "Mensageria com RabbitMQ"
npm run start:list
```

Saída esperada: `📋 List Service rodando na porta 3003` e `[RabbitMQ] Publisher conectado (list-service)`.

### Terminal C – Workers (Consumers)

```bash
cd "Mensageria com RabbitMQ"
npm run start:workers
```

Saída esperada:

- `[notification-worker] aguardando mensagens...`
- `[analytics-worker] aguardando mensagens...`

## 5. Fluxo HTTP de Demonstração (Terminal D)

1. **Criar lista**

   ```bash
   curl -s -X POST http://localhost:3003/lists \
     -H 'Content-Type: application/json' \
     -d '{"name":"Lista Rabbit","description":"Teste mensageria"}'
   ```

   Copiar o `id` retornado (exemplo: `8711fcd7-74b3-4bcc-bc8d-7585701bb1a1`).

2. **Adicionar itens à lista**

   ```bash
   LIST_ID="COLE_SEU_ID"

   curl -s -X POST "http://localhost:3003/lists/${LIST_ID}/items" \
     -H 'Content-Type: application/json' \
     -d '{"itemId":"cafe","itemName":"Café","quantity":2,"unit":"un","estimatedPrice":15.5,"notes":"Torra média"}'

   curl -s -X POST "http://localhost:3003/lists/${LIST_ID}/items" \
     -H 'Content-Type: application/json' \
     -d '{"itemId":"pao","itemName":"Pão","quantity":4,"unit":"un","estimatedPrice":3.2,"notes":"Integral"}'
   ```

3. **Realizar checkout**

   ```bash
   curl -s -o /tmp/checkout_response.json -w '%{http_code}' \
     -X POST "http://localhost:3003/lists/${LIST_ID}/checkout" \
     -H 'Content-Type: application/json' \
     -d '{"userEmail":"aluno@example.com"}'
   ```

   - Mostrar o `202` na tela
   - Exibir o corpo da resposta:

     ```bash
     cat /tmp/checkout_response.json
     ```

## 6. Evidências para o vídeo

- Terminal B: request `POST /checkout` retornando `202`
- Terminal C: logs imediatos
  - `📨 Enviando comprovante da lista ...`
  - `📊 Atualizando dashboard ...`
- Interface web RabbitMQ: fila com mensagens entrando e sendo ackadas

## 7. Finalização

```bash
pkill -f "workers/notification-worker.js" || true
pkill -f "workers/analytics-worker.js" || true
pkill -f "services/list-service/server.js" || true
docker stop rabbit
```

Pronto! O ambiente volta ao estado inicial.
