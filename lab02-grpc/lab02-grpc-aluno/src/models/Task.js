const ProtoLoader = require('../utils/protoLoader');

class Task {
  constructor(d){
    this.id=d.id; this.title=d.title; this.description=d.description||'';
    this.completed=!!d.completed; this.priority=d.priority||'medium';
    this.userId=d.userId||d.user_id; this.createdAt=d.createdAt||d.created_at; this.updatedAt=d.updatedAt||d.updated_at;
  }
  validate(){
    const errors=[];
    if(!this.title?.trim()) errors.push('Título é obrigatório');
    if(!this.userId) errors.push('Usuário é obrigatório');
    if(!['low','medium','high','urgent'].includes(this.priority)) errors.push('Prioridade deve ser: low, medium, high ou urgent');
    return { isValid: errors.length===0, errors };
  }
  toProtobuf(){
    return { id:this.id, title:this.title, description:this.description, completed:this.completed,
      priority: ProtoLoader.convertPriority(this.priority), user_id:this.userId,
      created_at: this.createdAt ? Math.floor(new Date(this.createdAt).getTime()/1000) : 0,
      updated_at: this.updatedAt ? Math.floor(new Date(this.updatedAt).getTime()/1000) : 0 };
  }
  static fromProtobuf(p){ return new Task({ id:p.id, title:p.title, description:p.description, completed:p.completed, priority:ProtoLoader.convertFromPriority(p.priority), user_id:p.user_id, created_at:p.created_at, updated_at:p.updated_at }); }
  toJSON(){ return { ...this }; }
}
module.exports = Task;
