const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const cache = require('../utils/cache'); // criado no passo 9.2

const router = express.Router();

// todas as rotas abaixo exigem auth
router.use(authMiddleware);

// LISTAR com paginação + filtros (completed, priority, category, tag, startDate, endDate)
router.get('/', async (req, res) => {
  try {
    const { completed, priority, category, tag, startDate, endDate } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const offset = (page - 1) * limit;

    const where = ['userId = ?'];
    const params = [req.user.id];

    if (completed !== undefined) { where.push('completed = ?'); params.push(completed === 'true' ? 1 : 0); }
    if (priority) { where.push('priority = ?'); params.push(priority); }
    if (category) { where.push('category = ?'); params.push(category); }
    if (tag) { where.push('tags LIKE ?'); params.push(`%${tag}%`); }
    if (startDate) { where.push('datetime(createdAt) >= datetime(?)'); params.push(startDate); }
    if (endDate) { where.push('datetime(createdAt) <= datetime(?)'); params.push(endDate); }

    const base = `FROM tasks WHERE ${where.join(' AND ')}`;

    // cache (se disponível)
    const cacheKey = ['tasks:list', { u: req.user.id, q: req.query, page, limit }];
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rows = await database.all(`SELECT * ${base} ORDER BY datetime(createdAt) DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const totalRow = await database.get(`SELECT COUNT(*) AS total ${base}`, params);

    const tasks = rows.map(r => new Task({ ...r, completed: r.completed === 1 })).map(t => t.toJSON());
    const payload = { success: true, data: tasks, meta: { page, limit, total: totalRow.total, pages: Math.ceil(totalRow.total / limit) } };

    cache.set(cacheKey, payload, 60_000);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// CRIAR
router.post('/', validate('task'), async (req, res) => {
  try {
    const task = new Task({ id: uuidv4(), ...req.body, userId: req.user.id });
    const v = task.validate();
    if (!v.isValid) return res.status(400).json({ success: false, message: 'Dados inválidos', errors: v.errors });

    await database.run(
      'INSERT INTO tasks (id, title, description, priority, userId, category, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [task.id, task.title, task.description, task.priority, task.userId, task.category || '', task.tags || '']
    );

    cache.delStartsWith(['tasks:list', { u: req.user.id }]);
    res.status(201).json({ success: true, message: 'Tarefa criada com sucesso', data: task.toJSON() });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// BUSCAR POR ID
router.get('/:id', async (req, res) => {
  try {
    const row = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    const task = new Task({ ...row, completed: row.completed === 1 });
    res.json({ success: true, data: task.toJSON() });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// ATUALIZAR
router.put('/:id', async (req, res) => {
  try {
    const { title, description, completed, priority, category, tags } = req.body;
    const result = await database.run(
      'UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ?, category = ?, tags = ? WHERE id = ? AND userId = ?',
      [title, description, completed ? 1 : 0, priority, category || '', tags || '', req.params.id, req.user.id]
    );
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });

    const updated = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    const task = new Task({ ...updated, completed: updated.completed === 1 });
    cache.delStartsWith(['tasks:list', { u: req.user.id }]);
    res.json({ success: true, message: 'Tarefa atualizada com sucesso', data: task.toJSON() });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// DELETAR
router.delete('/:id', async (req, res) => {
  try {
    const result = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    cache.delStartsWith(['tasks:list', { u: req.user.id }]);
    res.json({ success: true, message: 'Tarefa deletada com sucesso' });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// ESTATÍSTICAS
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await database.get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS pending
      FROM tasks WHERE userId = ?
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        ...stats,
        completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0
      }
    });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

module.exports = router;
