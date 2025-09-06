const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');
const path = require('path');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const def = loader.loadSync(path.join(__dirname, '../protos/chat_service.proto'), { keepCase: true, defaults: true, longs: Number });
const chat = grpc.loadPackageDefinition(def).chat;
const addr = process.env.GRPC_ADDR || 'localhost:50051';
const client = new chat.ChatService(addr, grpc.credentials.createInsecure());
const stream = client.Chat();
stream.on('data', (m) => {
    const ts = (m && typeof m.ts === 'object' && typeof m.ts.toNumber === 'function') ? m.ts.toNumber() : Number(m.ts || Date.now());
    console.log(`[${new Date(ts).toLocaleTimeString()}] ${m.user}: ${m.text}`);
});
stream.on('error', () => process.exit(1));
stream.on('end', () => process.exit(0));
const user = process.env.USERNAME || 'user';
(function loop() { rl.question('', (text) => { stream.write({ user, text, ts: Date.now() }); loop(); }); })();
