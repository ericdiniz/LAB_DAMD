const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const database = require('../database/database');
const ProtoLoader = require('../utils/protoLoader');

class TaskService {
  constructor(){ this.streamingSessions = new Map(); }
  async validateToken(token){
    try{ return jwt.verify(token, process.env.JWT_SECRET || 'seu-secret-aqui'); }
    catch{ throw new Error('Token inválido'); }
  }

  async createTask(call, callback){
    try{
      const { token, title, description, priority } = call.request;
      const user = await this.validateToken(token);
      if(!title?.trim()) return callback(null,{ success:false, message:'Título é obrigatório', errors:['Título não pode estar vazio']});
      const taskData = { id:uuidv4(), title:title.trim(), description:description||'', priority:ProtoLoader.convertFromPriority(priority), userId:user.id, completed:false };
      const task = new Task(taskData);
      const v = task.validate(); if(!v.isValid) return callback(null,{ success:false, message:'Dados inválidos', errors:v.errors });
      await database.run('INSERT INTO tasks (id,title,description,priority,userId) VALUES (?,?,?,?,?)',
        [task.id, task.title, task.description, task.priority, task.userId]);
      this.notifyStreams('TASK_CREATED', task);
      callback(null,{ success:true, message:'Tarefa criada com sucesso', task:task.toProtobuf() });
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code = (e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async getTasks(call, callback){
    try{
      const { token, completed, priority, page, limit } = call.request;
      const user = await this.validateToken(token);
      let sql='SELECT * FROM tasks WHERE userId = ?'; const params=[user.id];
      if(completed!==undefined && completed!==null){ sql+=' AND completed = ?'; params.push(completed?1:0); }
      if(priority!==undefined && priority!==null){ const p=ProtoLoader.convertFromPriority(priority); sql+=' AND priority = ?'; params.push(p); }
      sql+=' ORDER BY createdAt DESC';
      const pageNum=page||1, limitNum=Math.max(1, Math.min(limit||10, 100));
      const result = await database.getAllWithPagination(sql, params, pageNum, limitNum);
      const tasks = result.rows.map(r => new Task({...r, completed:r.completed===1}).toProtobuf());
      callback(null,{ success:true, tasks, total:result.total, page:result.page, limit:result.limit });
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code=(e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async getTask(call, callback){
    try{
      const { token, task_id } = call.request;
      const user = await this.validateToken(token);
      const row = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
      if(!row) return callback(null,{ success:false, message:'Tarefa não encontrada' });
      const task = new Task({...row, completed:row.completed===1});
      callback(null,{ success:true, message:'Tarefa encontrada', task:task.toProtobuf() });
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code=(e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async updateTask(call, callback){
    try{
      const { token, task_id, title, description, completed, priority } = call.request;
      const user = await this.validateToken(token);
      const existing = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
      if(!existing) return callback(null,{ success:false, message:'Tarefa não encontrada' });
      const updateData = {
        title: title || existing.title,
        description: (description!==undefined)?description:existing.description,
        completed: (completed!==undefined)?completed:(existing.completed===1),
        priority: (priority!==undefined)?ProtoLoader.convertFromPriority(priority):existing.priority
      };
      const res = await database.run('UPDATE tasks SET title=?, description=?, completed=?, priority=?, updatedAt=CURRENT_TIMESTAMP WHERE id=? AND userId=?',
        [updateData.title, updateData.description, updateData.completed?1:0, updateData.priority, task_id, user.id]);
      if(res.changes===0) return callback(null,{ success:false, message:'Falha ao atualizar tarefa' });
      const updated = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
      const task = new Task({...updated, completed:updated.completed===1});
      this.notifyStreams('TASK_UPDATED', task);
      callback(null,{ success:true, message:'Tarefa atualizada com sucesso', task:task.toProtobuf() });
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code=(e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async deleteTask(call, callback){
    try{
      const { token, task_id } = call.request;
      const user = await this.validateToken(token);
      const existing = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
      if(!existing) return callback(null,{ success:false, message:'Tarefa não encontrada' });
      const res = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
      if(res.changes===0) return callback(null,{ success:false, message:'Falha ao deletar tarefa' });
      const task = new Task({...existing, completed:existing.completed===1});
      this.notifyStreams('TASK_DELETED', task);
      callback(null,{ success:true, message:'Tarefa deletada com sucesso' });
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code=(e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async getTaskStats(call, callback){
    try{
      const { token } = call.request;
      const user = await this.validateToken(token);
      const s = await database.get(`SELECT COUNT(*) as total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN completed=0 THEN 1 ELSE 0 END) as pending FROM tasks WHERE userId = ?`, [user.id]);
      const rate = s.total>0 ? ((s.completed/s.total)*100) : 0;
      callback(null,{ success:true, stats:{ total:s.total, completed:s.completed, pending:s.pending, completion_rate: parseFloat(rate.toFixed(2)) }});
    }catch(e){ const err=new Error(e.message||'Erro interno'); err.code=(e.message==='Token inválido')?grpc.status.UNAUTHENTICATED:grpc.status.INTERNAL; callback(err); }
  }

  async streamTasks(call){
    try{
      const { token, completed } = call.request;
      const user = await this.validateToken(token);
      let sql='SELECT * FROM tasks WHERE userId = ?'; const params=[user.id];
      if(completed!==undefined && completed!==null){ sql+=' AND completed = ?'; params.push(completed?1:0); }
      sql+=' ORDER BY createdAt DESC';
      const rows = await database.all(sql, params);
      for(const r of rows){ const t=new Task({...r, completed:r.completed===1}); call.write(t.toProtobuf()); await new Promise(r=>setTimeout(r,100)); }
      const id=uuidv4(); this.streamingSessions.set(id,{ call, userId:user.id, filter:{completed} });
      call.on('cancelled', ()=> this.streamingSessions.delete(id));
    }catch(e){ console.error('Erro no stream de tarefas:', e); call.destroy(new Error(e.message||'Erro no streaming')); }
  }

  async streamNotifications(call){
    try{
      const { token } = call.request;
      const user = await this.validateToken(token);
      const id=uuidv4(); this.streamingSessions.set(id,{ call, userId:user.id, type:'notifications' });
      call.write({ type:0, message:'Stream de notificações iniciado', timestamp: Math.floor(Date.now()/1000) });
      call.on('cancelled', ()=> this.streamingSessions.delete(id));
      call.on('error', ()=> this.streamingSessions.delete(id));
    }catch(e){ console.error('Erro no stream de notificações:', e); call.destroy(new Error(e.message||'Erro no streaming')); }
  }

  notifyStreams(action, task){
    const map = { TASK_CREATED:0, TASK_UPDATED:1, TASK_DELETED:2, TASK_COMPLETED:3 };
    for(const [id,s] of this.streamingSessions.entries()){
      try{
        if(s.userId === task.userId){
          if(s.type === 'notifications'){
            s.call.write({ type: map[action], task: task.toProtobuf(), message:`Tarefa ${action.toLowerCase().replace('_',' ')}`, timestamp: Math.floor(Date.now()/1000) });
          } else {
            if(s.filter?.completed===undefined || s.filter?.completed===task.completed){
              s.call.write(task.toProtobuf());
            }
          }
        }
      }catch{ this.streamingSessions.delete(id); }
    }
  }
}
module.exports = TaskService;
