const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');
const path = require('path');
const chatImpl = require('./chatService');

module.exports = function (server) {
  const def = loader.loadSync(
    path.join(__dirname, '../protos/chat_service.proto'),
    { keepCase: true, defaults: true, longs: Number }
  );
  const chat = grpc.loadPackageDefinition(def).chat;
  server.addService(chat.ChatService.service, chatImpl);
};