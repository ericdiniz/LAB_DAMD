const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');
const path = require('path');
const database = require('../database/database');

const AuthServiceImpl = require('../services/AuthService');
const TaskServiceImpl = require('../services/TaskService');

async function main(){
  await database.init();

  const loader = new ProtoLoader();
  const authPkg = loader.loadProto('auth_service.proto', 'auth');
  const tasksPkg = loader.loadProto('task_service.proto', 'tasks');

  const server = new grpc.Server();
  server.addService(authPkg.AuthService.service, new AuthServiceImpl());
  server.addService(tasksPkg.TaskService.service, new TaskServiceImpl());

  const port = process.env.GRPC_PORT || 50051;
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, p)=>{
    if(err){ console.error('Erro ao subir gRPC:', err); process.exit(1); }
    console.log('🚀 =====================================');
    console.log('🚀 Servidor gRPC (aluno) iniciado');
    console.log(`🚀 Porta: ${p}`);
    console.log('🚀 Serviços: AuthService + TaskService');
    console.log('🚀 =====================================');
    server.start();
  });

  process.on('SIGINT', ()=> server.tryShutdown(()=>process.exit(0)));
  process.on('SIGTERM', ()=> server.tryShutdown(()=>process.exit(0)));
}

if(require.main===module) main();
module.exports = main;
