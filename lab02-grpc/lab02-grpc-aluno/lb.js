const net = require('net');

const backends = [
  { host: '127.0.0.1', port: 50051 },
  { host: '127.0.0.1', port: 50052 },
];
let idx = 0;

const server = net.createServer((client) => {
  const target = backends[idx % backends.length];
  idx++;
  const upstream = net.connect(target, () => {
    // opcional: log pra ver qual porta atendeu
    console.log('↔️  encaminhando conexão para', `${target.host}:${target.port}`);
  });

  client.pipe(upstream).pipe(client);

  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
});

server.listen(50050, '0.0.0.0', () => {
  console.log('✅ LB TCP (round-robin) ouvindo em :50050');
});
