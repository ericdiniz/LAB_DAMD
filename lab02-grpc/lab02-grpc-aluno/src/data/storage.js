const { v4: uuidv4 } = require('uuid');

class TaskStorage {
  constructor() {
    this.tasks = new Map();
    this.subscribers = new Set();
  }

  createTask(taskData) {
    const task = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description || '',
      completed: false,
      priority: taskData.priority || 'medium',
      user_id: taskData.user_id,
      created_at: Date.now()
    };
    this.tasks.set(task.id, task);
    this.notifySubscribers('CREATED', task);
    return task;
  }

  getTask(id) {
    return this.tasks.get(id) || null;
  }

  listTasks(userId, completed = null, priority = null) {
    return Array.from(this.tasks.values())
      .filter(t => t.user_id === userId)
      .filter(t => completed === null || t.completed === completed)
      .filter(t => !priority || t.priority === priority)
      .sort((a, b) => b.created_at - a.created_at);
  }

  updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updated = {
      ...task,
      ...updates,
      id: task.id,
      user_id: task.user_id,
      created_at: task.created_at
    };
    this.tasks.set(id, updated);
    this.notifySubscribers('UPDATED', updated);
    return updated;
  }

  deleteTask(id) {
    const task = this.tasks.get(id);
    if (!task) return false;
    this.tasks.delete(id);
    this.notifySubscribers('DELETED', task);
    return true;
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notifySubscribers(action, task) {
    this.subscribers.forEach(fn => {
      try { fn({ action, task }); } catch {}
    });
  }

  // <<< adicionado: estatísticas >>>
  getStats(userId) {
    const tasks = this.listTasks(userId);
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.length - completed;
    return {
      total: tasks.length,
      completed,
      pending,
      completion_rate: tasks.length ? (completed / tasks.length * 100).toFixed(2) : 0
    };
  }
}

module.exports = new TaskStorage();
