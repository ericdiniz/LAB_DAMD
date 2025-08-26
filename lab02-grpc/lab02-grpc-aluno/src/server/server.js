const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const TaskServiceImpl = require('./services/taskService');

class GRPCServer {
  constructor() {
    this.server = new grpc.Server();
    this.port = process.env.GRPC_PORT || 50051;
    this.loadProto();
    this.setupServices();
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

  setupServices() {
    const impl = new TaskServiceImpl();
    this.server.addService(this.taskPkg.TaskService.service, {
      createTask: impl.createTask.bind(impl),
      getTask: impl.getTask.bind(impl),
      listTasks: impl.listTasks.bind(impl),
      updateTask: impl.updateTask.bind(impl),
      deleteTask: impl.deleteTask.bind(impl),
      streamTaskUpdates: impl.streamTaskUpdates.bind(impl)
    });
  }

  start() {
    const addr = `0.0.0.0:${this.port}`;
    this.server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        console.error('❌ Erro ao iniciar gRPC:', err);
        process.exit(1);
      }
      console.log('🚀 =====================================');
      console.log('🚀 Servidor gRPC iniciado');
      console.log(`🚀 Porta: ${port}`);
      console.log('🚀 Protocolo: HTTP/2 + Protobuf');
      console.log('🚀 Serviços: TaskService (CRUD + Streaming)');
      console.log('🚀 =====================================');
      this.server.start();
    });
  }

  stop() {
    this.server.tryShutdown((e) => {
      if (e) console.error('Erro ao parar:', e);
      else console.log('✅ Servidor gRPC parado');
    });
  }
}

if (require.main === module) {
  const s = new GRPCServer();
  s.start();
  process.on('SIGINT', () => s.stop());
  process.on('SIGTERM', () => s.stop());
}

module.exports = GRPCServer;
