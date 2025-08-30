// bench/grpc-benchmark.js
/**
 * Benchmark gRPC (Passo 11) — usa BENCH_TOKEN se estiver definido.
 * ENV:
 *   GRPC_ADDR=localhost:50051
 *   BENCH_OP=list|create|stats   (padrão: list)
 *   TOTAL=500
 *   CONCURRENCY=20
 *   BENCH_TOKEN=<JWT gerado>
 */
const fs = require('fs');
const path = require('path');
const GrpcClient = require('../src/client/client');

function nowNs() {
  const [s, ns] = process.hrtime();
  return BigInt(s) * 1_000_000_000n + BigInt(ns);
}

function statsFrom(nsArray) {
  const arr = nsArray.map(Number).sort((a, b) => a - b);
  const n = arr.length || 1;
  const sum = arr.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const pct = p => arr[Math.min(n - 1, Math.max(0, Math.floor(p * n) - 1))];
  return {
    count: n,
    min_ms: arr[0] / 1e6,
    p50_ms: pct(0.50) / 1e6,
    p90_ms: pct(0.90) / 1e6,
    p95_ms: pct(0.95) / 1e6,
    p99_ms: pct(0.99) / 1e6,
    max_ms: arr[n - 1] / 1e6,
    avg_ms: avg / 1e6
  };
}

// fallback (se NÃO houver BENCH_TOKEN): registra e faz login usando o próprio client
async function ensureAuth(client) {
  const stamp = Date.now();
  const email = process.env.BENCH_EMAIL || `bench_${stamp}@test.com`;
  const username = process.env.BENCH_USERNAME || `bench_${stamp}`;
  const password = process.env.BENCH_PASSWORD || 'senha123';

  // tenta login (assinatura correta: identifier, password)
  try {
    const r = await client.login(username, password);
    if (r?.success && client.currentToken) return;
  } catch { }

  // registra e loga
  try {
    await client.register({
      email,
      username,
      password,
      first_name: 'Bench',
      last_name: 'User',
    });
  } catch { }

  const r2 = await client.login(username, password);
  if (!(r2?.success && client.currentToken)) {
    throw new Error('Falha ao obter token de autenticação');
  }
}

async function main() {
  const GRPC_ADDR = process.env.GRPC_ADDR || 'localhost:50051';
  const OP = (process.env.BENCH_OP || 'list').toLowerCase(); // list|create|stats
  const TOTAL = parseInt(process.env.TOTAL || '500', 10);
  const CONC = parseInt(process.env.CONCURRENCY || '20', 10);

  const client = new GrpcClient(GRPC_ADDR);
  await client.initialize();

  // Usa BENCH_TOKEN se presente (remove eventual prefixo "Bearer ")
  const envToken = (process.env.BENCH_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
  if (envToken) {
    client.currentToken = envToken;
  } else {
    await ensureAuth(client);
  }
  console.log('[BENCH] using token from', envToken ? 'ENV' : 'login/register',
    'len/prefix:', String(client.currentToken || '').length, String(client.currentToken || '').slice(0, 20));

  // Warm-up: garante uma tarefa para não listar vazio (ASSINATURA CORRETA)
  try {
    console.log('[BENCH] warmup createTask with token len:', String(client.currentToken || '').length);
    await client.createTask('Warmup Task', 'warmup', 'low');
  } catch { }

  // ==== Chamadas com assinaturas corretas do seu GrpcClient ====
  async function doList() {
    // getTasks({ page, limit })
    await client.getTasks({ page: 1, limit: 10 }); // sem filtros
  }
  async function doCreate(i) {
    // createTask(title, description, priority, user?)
    await client.createTask(`Bench Task #${i}`, 'desc', 'low');
  }
  async function doStats() {
    await client.getStats();
  }
  // ============================================================

  async function oneCall(i) {
    if (OP === 'create') return doCreate(i);
    if (OP === 'stats') return doStats();
    return doList(); // default: list
  }

  // Warmup curto
  for (let i = 0; i < Math.min(20, TOTAL); i++) {
    await oneCall(i);
  }

  const latNs = [];
  const startNs = nowNs();

  const perWorker = Math.ceil(TOTAL / CONC);
  const workers = Array.from({ length: CONC }, (_, w) => (async () => {
    const startIdx = w * perWorker;
    const endIdx = Math.min(TOTAL, startIdx + perWorker);
    for (let i = startIdx; i < endIdx; i++) {
      const t0 = nowNs();
      await oneCall(i);
      const t1 = nowNs();
      latNs.push(Number(t1 - t0));
    }
  })());

  await Promise.all(workers);

  const endNs = nowNs();
  const elapsedMs = Number(endNs - startNs) / 1e6;
  const s = statsFrom(latNs);
  const rps = (TOTAL / (elapsedMs / 1000));

  const summary = {
    meta: { grpc_address: GRPC_ADDR, op: OP, total: TOTAL, concurrency: CONC, used_token: !!envToken },
    time: { elapsed_ms: elapsedMs },
    latency_ms: s,
    throughput_rps: rps,
  };

  // salvar arquivos (para o professor)
  const outDir = path.join(process.cwd(), 'resultados', 'passo11');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `benchmark-${OP}-${stamp}.json`);
  const mdPath = path.join(outDir, `benchmark-${OP}-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    '# Benchmark gRPC (Passo 11)',
    `- **Servidor**: \`${GRPC_ADDR}\``,
    `- **Operação**: \`${OP}\``,
    `- **Total requisições**: \`${TOTAL}\``,
    `- **Concorrência**: \`${CONC}\``,
    `- **Tempo total**: \`${summary.time.elapsed_ms.toFixed(2)} ms\``,
    `- **Throughput**: \`${summary.throughput_rps.toFixed(2)} req/s\``,
    '## Latência (ms)',
    `- min: \`${s.min_ms.toFixed(3)}\``,
    `- p50: \`${s.p50_ms.toFixed(3)}\``,
    `- p90: \`${s.p90_ms.toFixed(3)}\``,
    `- p95: \`${s.p95_ms.toFixed(3)}\``,
    `- p99: \`${s.p99_ms.toFixed(3)}\``,
    `- max: \`${s.max_ms.toFixed(3)}\``,
    `- média: \`${s.avg_ms.toFixed(3)}\``,
    '',
    `> Token via ENV: \`${envToken ? 'SIM' : 'NÃO'}\``,
    `> Arquivo JSON salvo para auditoria.`
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(JSON.stringify(summary, null, 2));
  console.error(`\n📦 Resultados salvos:\n- ${jsonPath}\n- ${mdPath}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Erro no benchmark:', err);
  process.exit(1);
});