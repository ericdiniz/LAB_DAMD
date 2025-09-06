const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');
const AuthService = require('../services/AuthService');
const TaskService = require('../services/TaskService');
const database = require('../database/database');

class GrpcServer {
  constructor() {
    this.server = new grpc.Server();
    this.loader = new ProtoLoader();
    this.authService = new AuthService();
    this.taskService = new TaskService();
  }

  async initialize() {
    // 1) Banco
    await database.init();

    // 2) Carregar protos (USANDO /proto)
    const authPkg = this.loader.loadProto('auth_service.proto', 'auth');
    const tasksPkg = this.loader.loadProto('task_service.proto', 'tasks');

    // 3) Registrar serviços conforme o .proto
    this.server.addService(authPkg.AuthService.service, {
      Register: this.authService.register.bind(this.authService),
      Login: this.authService.login.bind(this.authService),
      ValidateToken: this.authService.validateToken.bind(this.authService),
    });

    this.server.addService(tasksPkg.TaskService.service, {
      CreateTask: this.taskService.createTask.bind(this.taskService),
      GetTasks: this.taskService.getTasks.bind(this.taskService),
      GetTask: this.taskService.getTask.bind(this.taskService),
      UpdateTask: this.taskService.updateTask.bind(this.taskService),
      DeleteTask: this.taskService.deleteTask.bind(this.taskService),
      GetTaskStats: this.taskService.getTaskStats.bind(this.taskService),
      StreamTasks: this.taskService.streamTasks.bind(this.taskService),
      StreamNotifications: this.taskService.streamNotifications.bind(this.taskService),
    });

    require('./registerChat')(this.server);
    console.log('✅ Serviços gRPC registrados');
  }

  async start(port = process.env.GRPC_PORT || 50051) {
    await this.initialize();
    this.server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          console.error('❌ Falha ao iniciar:', err);
          process.exit(1);
        }
        this.server.start(); // (deprecation safe)
        console.log('🚀 =================================');
        console.log(`🚀 Servidor gRPC iniciado na porta ${boundPort}`);
        console.log('🚀 Serviços: AuthService + TaskService');
        console.log('🚀 Protocolo: gRPC/HTTP2 | Serialização: Protobuf');
        console.log('🚀 =================================');
      }
    );

    // Graceful shutdown
    const shutdown = () =>
      this.server.tryShutdown(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

if (require.main === module) {
  const s = new GrpcServer();
  s.start();
}

module.exports = GrpcServer;
