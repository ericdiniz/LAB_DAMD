const storage = require('../../data/storage');

class TaskServiceImpl {
  createTask(call, callback) {
    try {
      const { title, description, priority, user_id } = call.request;
      if (!title?.trim()) {
        return callback(null, { success: false, message: 'Título é obrigatório', task: null });
      }
      if (!user_id?.trim()) {
        return callback(null, { success: false, message: 'User ID é obrigatório', task: null });
      }
      const task = storage.createTask({
        title: title.trim(),
        description: (description || '').trim(),
        priority: priority || 'medium',
        user_id: user_id.trim()
      });
      callback(null, { success: true, message: 'Tarefa criada com sucesso', task });
    } catch (e) {
      console.error('Erro ao criar tarefa:', e);
      callback(null, { success: false, message: 'Erro interno do servidor', task: null });
    }
  }

  getTask(call, callback) {
    try {
      const task = storage.getTask(call.request.id);
      if (!task) return callback(null, { success: false, message: 'Tarefa não encontrada', task: null });
      callback(null, { success: true, message: 'Tarefa encontrada', task });
    } catch (e) {
      console.error('Erro ao buscar tarefa:', e);
      callback(null, { success: false, message: 'Erro interno do servidor', task: null });
    }
  }

  listTasks(call, callback) {
    try {
      const { user_id, completed, priority } = call.request;
      const completedFilter = (typeof completed === 'boolean') ? completed : null;
      const tasks = storage.listTasks(user_id, completedFilter, priority || null);
      callback(null, { success: true, message: `${tasks.length} tarefa(s)`, tasks, total: tasks.length });
    } catch (e) {
      console.error('Erro ao listar tarefas:', e);
      callback(null, { success: false, message: 'Erro interno do servidor', tasks: [], total: 0 });
    }
  }

  updateTask(call, callback) {
    try {
      const { id, title, description, completed, priority } = call.request;
      const updates = {};
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description.trim();
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;

      const task = storage.updateTask(id, updates);
      if (!task) return callback(null, { success: false, message: 'Tarefa não encontrada', task: null });
      callback(null, { success: true, message: 'Tarefa atualizada', task });
    } catch (e) {
      console.error('Erro ao atualizar tarefa:', e);
      callback(null, { success: false, message: 'Erro interno do servidor', task: null });
    }
  }

  deleteTask(call, callback) {
    try {
      const ok = storage.deleteTask(call.request.id);
      if (!ok) return callback(null, { success: false, message: 'Tarefa não encontrada' });
      callback(null, { success: true, message: 'Tarefa deletada' });
    } catch (e) {
      console.error('Erro ao deletar tarefa:', e);
      callback(null, { success: false, message: 'Erro interno do servidor' });
    }
  }

  streamTaskUpdates(call) {
    const { user_id } = call.request;
    console.log(`🔄 stream iniciado para user_id=${user_id}`);

    // enviar existentes
    storage.listTasks(user_id).forEach(task => {
      call.write({ success: true, message: 'Tarefa existente', task });
    });

    // assinar futuras
    const unsubscribe = storage.subscribe(({ action, task }) => {
      if (task.user_id === user_id) {
        call.write({ success: true, message: `Tarefa ${action.toLowerCase()}`, task });
      }
    });

    const cleanup = () => { try { unsubscribe(); } catch {} };
    call.on('close', cleanup);
    call.on('end', cleanup);
    call.on('error', (e) => {
      // silencia cancelamento pelo cliente
      if (e?.code !== 1) console.error('stream error:', e?.message || e);
      cleanup();
    });
  }
}

module.exports = TaskServiceImpl;
