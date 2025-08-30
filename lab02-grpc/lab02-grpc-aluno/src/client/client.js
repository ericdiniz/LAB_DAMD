const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class TaskGRPCClient {
  constructor(serverAddress = 'localhost:50051') {
    this.serverAddress = serverAddress;
    this.loadProto();
    this.client = new this.taskPkg.TaskService(
      this.serverAddress,
      grpc.credentials.createInsecure()
    );
  }

  loadProto() {
    const PROTO_PATH = path.join(__dirname, '../../proto/task.proto');
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: false,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(packageDefinition);
    this.taskPkg = descriptor.task;
  }

  createTask(title, description = '', priority = 'medium', userId = 'user1') {
    return new Promise((resolve, reject) => {
      this.client.createTask({ title, description, priority, user_id: userId },
        (err, res) => err ? reject(err) : resolve(res)
      );
    });
  }

  getTask(id) {
    return new Promise((resolve, reject) => {
      this.client.getTask({ id }, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  listTasks(userId = 'user1', completed, priority) {
    return new Promise((resolve, reject) => {
      const req = { user_id: userId };
      if (typeof completed === 'boolean') req.completed = completed;
      if (priority) req.priority = priority;
      this.client.listTasks(req, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  updateTask(id, updates) {
    return new Promise((resolve, reject) => {
      this.client.updateTask({ id, ...updates }, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  deleteTask(id) {
    return new Promise((resolve, reject) => {
      this.client.deleteTask({ id }, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  streamTaskUpdates(userId = 'user1', onUpdate) {
    const stream = this.client.streamTaskUpdates({ user_id: userId });
    stream.on('data', (res) => onUpdate?.(res));
    stream.on('error', (err) => {
      if (err?.code !== grpc.status.CANCELLED) console.error('Erro no stream:', err);
    });
    stream.on('end', () => console.log('Stream finalizado'));
    return stream;
  }

  close() { this.client.close(); }
}

// Demonstração quando executado diretamente
async function demonstrateGRPC() {
  const client = new TaskGRPCClient();
  const userId = 'demo-user';
  console.log('🔄 Demonstração Cliente gRPC\n');

  try {
    console.log('📝 Criando tarefas...');
    const t1 = await client.createTask('Estudar gRPC', 'Aprender Protobuf e streaming', 'high', userId);
    console.log(`✅ Tarefa criada: ${t1.task.title}`);
    const t2 = await client.createTask('Implementar servidor', 'Node.js', 'medium', userId);
    console.log(`✅ Tarefa criada: ${t2.task.title}`);

    console.log('\n📋 Listando tarefas...');
    const list = await client.listTasks(userId);
    console.log(`📊 Total: ${list.total}`);
    list.tasks.forEach(t => console.log(`  - ${t.title} [${t.priority}]`));

    console.log('\n�� Atualizando tarefa...');
    const upd = await client.updateTask(t1.task.id, { completed: true, title: 'Estudar gRPC - Concluído!' });
    console.log(`✅ Atualizada: ${upd.task.title}`);

    console.log('\n🌊 Iniciando stream de atualizações...');
    const stream = client.streamTaskUpdates(userId, (u) => {
      console.log(`📨 ${u.message}${u.task ? `: ${u.task.title}` : ''}`);
    });

    setTimeout(async () => { await client.createTask('Nova via stream', 'Teste', 'low', userId); }, 2000);
    setTimeout(async () => { await client.updateTask(t2.task.id, { completed: true }); }, 4000);
    setTimeout(() => { stream.cancel(); client.close(); console.log('\n✅ Demonstração concluída'); }, 6000);

  } catch (e) {
    console.error('❌ Erro:', e);
  }
}

if (require.main === module) demonstrateGRPC();

module.exports = TaskGRPCClient;
