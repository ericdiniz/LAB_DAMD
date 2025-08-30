const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');

class GrpcClient {
  constructor(serverAddress = 'localhost:50051') {
    this.serverAddress = serverAddress;
    this.loader = new ProtoLoader();
    this.authClient = null;
    this.taskClient = null;
    this.token = null;
  }

  async init() {
    const authPkg = this.loader.loadProto('auth_service.proto', 'auth');
    const tasksPkg = this.loader.loadProto('task_service.proto', 'tasks');
    const creds = grpc.credentials.createInsecure();
    this.authClient = new authPkg.AuthService(this.serverAddress, creds);
    this.taskClient = new tasksPkg.TaskService(this.serverAddress, creds);
    console.log('✅ Cliente gRPC inicializado');
  }

  // helper de promisificação
  p(client, method) {
    return (req) => new Promise((resolve, reject) => {
      client[method](req, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  async register({ email, username, password, first_name, last_name }) {
    const fn = this.p(this.authClient, 'Register');
    return fn({ email, username, password, first_name, last_name });
  }

  async login({ identifier, password }) {
    const fn = this.p(this.authClient, 'Login');
    const res = await fn({ identifier, password });
    if (res.success) this.token = res.token;
    return res;
  }

  async createTask({ title, description = '', priority = 1 }) {
    const fn = this.p(this.taskClient, 'CreateTask');
    return fn({ token: this.token, title, description, priority });
  }

  async getTasks(filters = {}) {
    const fn = this.p(this.taskClient, 'GetTasks');
    return fn({ token: this.token, ...filters });
  }

  async getTask(task_id) {
    const fn = this.p(this.taskClient, 'GetTask');
    return fn({ token: this.token, task_id });
  }

  async updateTask(task_id, updates) {
    const fn = this.p(this.taskClient, 'UpdateTask');
    return fn({ token: this.token, task_id, ...updates });
  }

  async deleteTask(task_id) {
    const fn = this.p(this.taskClient, 'DeleteTask');
    return fn({ token: this.token, task_id });
  }

  async getStats() {
    const fn = this.p(this.taskClient, 'GetTaskStats');
    return fn({ token: this.token });
  }

  // streams (opcional na demo)
  streamTasks(filters = {}) {
    const stream = this.taskClient.StreamTasks({ token: this.token, ...filters });
    stream.on('data', (t) => console.log('�� Stream Task:', t.title, 'done?', t.completed));
    stream.on('error', (e) => console.error('stream tasks error:', e.message));
    stream.on('end', () => console.log('📋 Stream tasks finalizado'));
    return stream;
  }

  streamNotifications() {
    const stream = this.taskClient.StreamNotifications({ token: this.token });
    const types = ['CREATED','UPDATED','DELETED','COMPLETED'];
    stream.on('data', (n) => console.log('🔔 Notif:', types[n.type], n.message, n.task?.title || ''));
    stream.on('error', (e) => console.error('stream notif error:', e.message));
    stream.on('end', () => console.log('🔔 Stream notificações finalizado'));
    return stream;
  }
}

// Demonstração rápida
async function demo() {
  const c = new GrpcClient();
  await c.init();

  const uniq = Date.now();
  console.log('\n1) Registrando...');
  const reg = await c.register({
    email: `usuario${uniq}@teste.com`,
    username: `user${uniq}`,
    password: 'senha123',
    first_name: 'Aluno',
    last_name: 'gRPC'
  });
  console.log('Registro:', reg.message);

  console.log('\n2) Login...');
  const login = await c.login({ identifier: `usuario${uniq}@teste.com`, password: 'senha123' });
  console.log('Login:', login.message);

  console.log('\n3) Criando tarefa...');
  const created = await c.createTask({ title: 'Estudar gRPC', description: 'Proto + streaming', priority: 2 });
  console.log('Criada:', created.task.title);

  console.log('\n4) Listando...');
  const list = await c.getTasks({ page: 1, limit: 10 });
  console.log('Total:', list.total);

  if (list.tasks?.length) {
    const id = list.tasks[0].id;
    console.log('\n5) GetTask...');
    const one = await c.getTask(id);
    console.log('Encontrada:', one.task.title);

    console.log('\n6) UpdateTask...');
    const upd = await c.updateTask(id, { completed: true, title: one.task.title + ' ✅' });
    console.log('Atualizada:', upd.task.title, 'done?', upd.task.completed);
  }

  console.log('\n7) Stats...');
  const stats = await c.getStats();
  console.log('Stats:', stats.stats);

  // Streams (opcional)
  // const s1 = c.streamNotifications();
  // const s2 = c.streamTasks();
  // setTimeout(() => { s1.cancel(); s2.cancel(); }, 3000);
}

if (require.main === module) {
  demo().catch(e => console.error('❌ Erro na demo:', e));
}

module.exports = GrpcClient;
