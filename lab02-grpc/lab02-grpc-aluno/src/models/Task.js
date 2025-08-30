class Task {
  constructor({ id, title, description = '', completed = false, priority = 'medium', userId, createdAt, updatedAt }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.completed = !!completed;
    this.priority = priority; // 'low' | 'medium' | 'high' | 'urgent' (mapearemos no proto)
    this.userId = userId;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;
  }
}
module.exports = Task;
