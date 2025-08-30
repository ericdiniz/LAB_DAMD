const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');

class AuthService {
  async register(call, callback){
    try{
      const { email, username, password, first_name, last_name } = call.request;
      if(!email || !username || !password || !first_name || !last_name){
        return callback(null,{ success:false, message:'Todos os campos são obrigatórios', errors:['Campos obrigatórios não preenchidos']});
      }
      const existing = await database.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
      if(existing){ return callback(null,{ success:false, message:'Email ou username já existe', errors:['Usuário já cadastrado']}); }
      const user = new User({ id:uuidv4(), email, username, password, firstName:first_name, lastName:last_name });
      await user.hashPassword();
      await database.run('INSERT INTO users (id,email,username,password,firstName,lastName) VALUES (?,?,?,?,?,?)',
        [user.id,user.email,user.username,user.password,user.firstName,user.lastName]);
      const token = user.generateToken();
      callback(null,{ success:true, message:'Usuário criado com sucesso', user:user.toProtobuf(), token });
    }catch(e){
      console.error('Erro no registro:', e);
      callback(null,{ success:false, message:'Erro interno do servidor', errors:['Falha no processamento']});
    }
  }

  async login(call, callback){
    try{
      const { identifier, password } = call.request;
      if(!identifier || !password){ return callback(null,{ success:false, message:'Credenciais obrigatórias', errors:['Email/username e senha são obrigatórios']}); }
      const row = await database.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
      if(!row){ return callback(null,{ success:false, message:'Credenciais inválidas', errors:['Usuário não encontrado']}); }
      const user = new User(row);
      const ok = await user.comparePassword(password);
      if(!ok){ return callback(null,{ success:false, message:'Credenciais inválidas', errors:['Senha incorreta']}); }
      const token = user.generateToken();
      callback(null,{ success:true, message:'Login realizado com sucesso', user:user.toProtobuf(), token });
    }catch(e){
      console.error('Erro no login:', e);
      callback(null,{ success:false, message:'Erro interno do servidor', errors:['Falha no processamento']});
    }
  }

  async validateToken(call, callback){
    try{
      const { token } = call.request;
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'seu-secret-aqui';
      if(!token) return callback(null,{ valid:false, message:'Token não fornecido' });
      const decoded = jwt.verify(token, secret);
      const row = await database.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
      if(!row) return callback(null,{ valid:false, message:'Usuário não encontrado' });
      const user = new User(row);
      callback(null,{ valid:true, user:user.toProtobuf(), message:'Token válido' });
    }catch(e){ callback(null,{ valid:false, message:'Token inválido' }); }
  }
}
module.exports = AuthService;
