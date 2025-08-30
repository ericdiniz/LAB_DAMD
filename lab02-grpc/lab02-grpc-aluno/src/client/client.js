const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');

class GrpcClient {
  constructor(serverAddress = 'localhost:50051') {
    this.serverAddress = serverAddress;
    this.protoLoader = new ProtoLoader();
    this.authClient = null;
    this.taskClient = null;
    this.currentToken = null;
  }

  async initialize() {
    const authProto = this.protoLoader.loadProto('auth_service.proto', 'auth');
    const taskProto = this.protoLoader.loadProto('task_service.proto', 'tasks');

    const creds = grpc.credentials.createInsecure();
    this.authClient = new authProto.AuthService(this.serverAddress, creds);
    this.taskClient = new taskProto.TaskService(this.serverAddress, creds);
    console.log('✅ Cliente gRPC inicializado');
  }

  // helper para promisificar chamadas
  _call(client, method, req) {
    return new Promise((resolve, reject) => {
      client[method](req, (err, res) => err ? reject(err) : resolve(res));
    });
  }

  // Auth
  async register(userData) {
    return this._call(this.authClient, 'Register', userData);
  }
  async login({ identifier, password }) {
    const res = await this._call(this.authClient, 'Login', { identifier, password });
    if (res?.success && res?.token) this.currentToken = res.token;
    return res;
  }
  async validateToken(token) {
    return this._call(this.authClient, 'ValidateToken', { token });
  }

  // Tasks
  async createTask({ title, description = '', priority = 1 }) {
    return this._call(this.taskClient, 'CreateTask', {
      token: this.currentToken, title, description, priority
    });
  }
  async getTasks({ completed, priority, page = 1, limit = 10 } = {}) {
    const req = { token: this.currentToken, page, limit };
    if (typeof completed === 'boolean') req.completed = completed;
    if (priority !== undefined) req.priority = priority;
    return this._call(this.taskClient, 'GetTasks', req);
  }
  async getTask(taskId) {
    return this._call(this.taskClient, 'GetTask', { token: this.currentToken, task_id: taskId });
  }
  async updateTask(taskId, updates) {
    return this._call(this.taskClient, 'UpdateTask', { token: this.currentToken, task_id: taskId, ...updates });
  }
  async deleteTask(taskId) {
    return this._call(this.taskClient, 'DeleteTask', { token: this.currentToken, task_id: taskId });
  }
  async getStats() {
    return this._call(this.taskClient, 'GetTaskStats', { token: this.currentToken });
  }

  // Streams (usados pelo teste só para smoke/cancelar)
  streamTasks(filters = {}) {
    return this.taskClient.StreamTasks({ token: this.currentToken, ...filters });
  }
  streamNotifications() {
    return this.taskClient.StreamNotifications({ token: this.currentToken });
  }
}

module.exports = GrpcClient;

// Executável manual (opcional) para debug rápido:
if (require.main === module) {
  (async () => {
    const c = new GrpcClient();
    await c.initialize();
    const reg = await c.register({
      email: `cli_${Date.now()}@test.com`,
      username: `cli_${Date.now()}`,
      password: 'senha123',
      first_name: 'Cli',
      last_name: 'Test'
    });
    console.log('Registro:', reg.success);
  })().catch(e => console.error(e));
}
