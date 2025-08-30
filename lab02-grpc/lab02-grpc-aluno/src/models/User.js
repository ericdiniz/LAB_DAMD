const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = { jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui', jwtExpiration: '24h' };

class User {
  constructor(d){ this.id=d.id; this.email=d.email; this.username=d.username; this.password=d.password; this.firstName=d.firstName||d.first_name; this.lastName=d.lastName||d.last_name; this.createdAt=d.createdAt||d.created_at; }
  async hashPassword(){ this.password = await bcrypt.hash(this.password, 12); }
  async comparePassword(p){ return bcrypt.compare(p, this.password); }
  generateToken(){ return jwt.sign({id:this.id,email:this.email,username:this.username}, config.jwtSecret, {expiresIn:config.jwtExpiration}); }
  toProtobuf(){ return { id:this.id, email:this.email, username:this.username, first_name:this.firstName, last_name:this.lastName, created_at: this.createdAt ? Math.floor(new Date(this.createdAt).getTime()/1000) : 0 }; }
  toJSON(){ const {password, ...u} = this; return u; }
}
module.exports = User;
