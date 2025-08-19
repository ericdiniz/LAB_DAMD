const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const { completed, priority } = req.query;
        let sql = 'SELECT * FROM tasks WHERE userId = ?';
        const params = [req.user.id];
        if (completed !== undefined) { sql += ' AND completed = ?'; params.push(completed === 'true' ? 1 : 0); }
        if (priority) { sql += ' AND priority = ?'; params.push(priority); }
        sql += ' ORDER BY createdAt DESC';
        const rows = await database.all(sql, params);
        const tasks = rows.map(r => new Task({ ...r, completed: r.completed === 1 }));
        res.json({ success: true, data: tasks.map(t => t.toJSON()) });
    } catch {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.post('/', validate('task'), async (req, res) => {
    try {
        const task = new Task({ id: uuidv4(), ...req.body, userId: req.user.id });
        const v = task.validate();
        if (!v.isValid) return res.status(400).json({ success: false, message: 'Dados inválidos', errors: v.errors });
        await database.run('INSERT INTO tasks (id, title, description, priority, userId) VALUES (?, ?, ?, ?, ?)', [task.id, task.title, task.description, task.priority, task.userId]);
        res.status(201).json({ success: true, message: 'Tarefa criada com sucesso', data: task.toJSON() });
    } catch {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

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

router.put('/:id', async (req, res) => {
    try {
        const { title, description, completed, priority } = req.body;
        const result = await database.run('UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ? WHERE id = ? AND userId = ?', [title, description, completed ? 1 : 0, priority, req.params.id, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        const updated = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        const task = new Task({ ...updated, completed: updated.completed === 1 });
        res.json({ success: true, message: 'Tarefa atualizada com sucesso', data: task.toJSON() });
    } catch {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        res.json({ success: true, message: 'Tarefa deletada com sucesso' });
    } catch {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await database.get('SELECT COUNT(*) total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) completed, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) pending FROM tasks WHERE userId = ?', [req.user.id]);
        const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0;
        res.json({ success: true, data: { ...stats, completionRate } });
    } catch {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
