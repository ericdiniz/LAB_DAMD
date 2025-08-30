# ⚡ Comandos de Execução Final (Passo 15 — Bloco 7)

Este arquivo consolida os comandos que você pode usar para rodar o projeto, os testes e os benchmarks.

## 1) Setup completo
```bash
npm install
```

## 2) Executar servidor principal (gRPC na porta 50051)
```bash
npm start
```

## 3) Executar cliente de exemplo
```bash
npm run client
```

## 4) Debug interativo (debug-client)
```bash
npm run debug:client
# ou salvando a sessão em resultados/passo13/debug-session.txt
npm run debug:client:save
```

## 5) Testes completos
```bash
npm test
```

## 6) Testes em modo watch
```bash
npm run test:watch
```

## 7) Testes com cobertura
```bash
npx jest --coverage
# (Opcional) salvar cobertura em arquivos
npx jest --coverage --json --outputFile=./resultados/passo12/coverage.json
npx jest --coverage | tee resultados/passo12/coverage.txt
```

## 8) Benchmark gRPC (Passo 11)
```bash
# Padrão (list, TOTAL=500, CONCURRENCY=20)
npm run bench:grpc

# Create (200 req, conc 10)
TOTAL=200 CONCURRENCY=10 BENCH_OP=create npm run bench:grpc

# Stats (800 req, conc 50)
TOTAL=800 CONCURRENCY=50 BENCH_OP=stats npm run bench:grpc
```

## 9) Benchmark vs REST (opcional, se tiver o lab01)
```bash
# Terminal 1: gRPC
npm start

# Terminal 2: REST (projeto do Roteiro 1)
cd ../lab01-servidor-tradicional
npm start

# Terminal 3: benchmark comparativo (adaptar para seu script)
cd ../lab02-grpc-aluno
npm run benchmark
```
