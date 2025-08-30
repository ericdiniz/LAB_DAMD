const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');
const config = { jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui' };

class AuthInterceptor {
  static validateToken(call, callback, next) {
    const token = call.request?.token;
    if (!token) {
      const err = new Error('Token de autenticação obrigatório');
      err.code = grpc.status.UNAUTHENTICATED; return callback(err);
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      call.user = decoded;
      if (next) return next(call, callback);
    } catch(e){
      const err = new Error('Token inválido'); err.code = grpc.status.UNAUTHENTICATED; return callback(err);
    }
  }
}

module.exports = AuthInterceptor;
