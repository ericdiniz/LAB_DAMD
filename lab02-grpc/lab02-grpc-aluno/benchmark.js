#!/usr/bin/env node
// Wrapper para manter "npm run benchmark" funcionando com o bench do Passo 11.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const total = parseInt(process.argv[2] || '500', 10);
const conc  = parseInt(process.argv[3] || '20', 10);
const bench = path.join(__dirname, 'bench', 'grpc-benchmark.js');

function run(op, totalArg, concArg) {
  const env = { ...process.env, BENCH_OP: op, TOTAL: String(totalArg), CONCURRENCY: String(concArg) };
  console.log(`\n=== Benchmark ${op.toUpperCase()} | TOTAL=${env.TOTAL} CONCURRENCY=${env.CONCURRENCY} ===`);
  const r = spawnSync(process.execPath, [bench], { stdio: 'inherit', env });
  if (r.status !== 0) {
    console.error(`\n[benchmark.js] ${op} falhou (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

run('list',   total, conc);
run('create', Math.max(200, Math.floor(total/2)), Math.max(10, Math.floor(conc/2)));
run('stats',  Math.max(800, total*2),            Math.max(50, conc*2));
