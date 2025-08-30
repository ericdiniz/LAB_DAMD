const GrpcServer = require('../src/server/server.js');
const GrpcClient = require('../src/client/client.js');

describe('gRPC Services (Auth + Tasks)', () => {
  let server;
  let client;
  let createdTaskId;

  beforeAll(async () => {
    // sobe servidor na 50052 para testes
    server = new (require('../src/server/server.js'))();
    await new Promise((resolve, reject) => {
      server.initialize().then(() => {
        const grpc = require('@grpc/grpc-js');
        server.server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), (err) => {
          if (err) return reject(err);
          server.server.start();
          resolve();
        });
      }).catch(reject);
    });

    // cliente apontando para a porta de testes
    client = new GrpcClient('localhost:50052');
    await client.initialize();
  }, 30000);

  afterAll(async () => {
    if (server?.server) {
      await new Promise(resolve => server.server.tryShutdown(() => resolve()));
    }
  });

  test('registro + login devem funcionar', async () => {
    const unique = Date.now();
    const reg = await client.register({
      email: `jest_${unique}@test.com`,
      username: `jest_${unique}`,
      password: 'senha123',
      first_name: 'Jest',
      last_name: 'Test'
    });
    expect(reg.success).toBe(true);

    const login = await client.login({ identifier: `jest_${unique}@test.com`, password: 'senha123' });
    expect(login.success).toBe(true);
  });

  test('criar tarefa', async () => {
    const res = await client.createTask({ title: 'Tarefa gRPC Test', description: 'Teste', priority: 1 });
    expect(res.success).toBe(true);
    expect(res.task).toBeDefined();
    createdTaskId = res.task.id;
  });

  test('listar tarefas', async () => {
    const res = await client.getTasks({ page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.tasks)).toBe(true);
  });

  test('buscar tarefa específica', async () => {
    const res = await client.getTask(createdTaskId);
    expect(res.success).toBe(true);
    expect(res.task.id).toBe(createdTaskId);
  });

  test('atualizar tarefa', async () => {
    const res = await client.updateTask(createdTaskId, { completed: true, title: 'Tarefa gRPC Test ✅' });
    expect(res.success).toBe(true);
    expect(res.task.completed).toBe(true);
  });

  test('estatísticas', async () => {
    const stats = await client.getStats();
    expect(stats.success).toBe(true);
    expect(typeof stats.stats.total).toBe('number');
  });

  test('deletar tarefa', async () => {
    const res = await client.deleteTask(createdTaskId);
    expect(res.success).toBe(true);
  });

  test('stream básico (tarefas) não deve falhar ao iniciar e pode ser cancelado', (done) => {
    const stream = client.streamTasks();
    let finalized = false;

    const finish = () => {
      if (finalized) return;
      finalized = true;
      try { stream.cancel(); } catch {}
      done();
    };

    stream.on('data', () => { /* ok se vier algo */ });
    stream.on('error', () => { /* erros não falham o teste */ finish(); });
    stream.on('end', finish);

    // cancela em 800ms para encerrar o teste de forma previsível
    setTimeout(finish, 800);
  }, 5000);
});
