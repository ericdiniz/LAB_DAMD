const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DB_DIR, 'tasks.json');

async function readTasks() {
    await fs.ensureDir(DB_DIR);
    if (!(await fs.pathExists(TASKS_FILE))) {
        await fs.writeJson(TASKS_FILE, []);
    }
    return fs.readJson(TASKS_FILE);
}

async function writeTasks(tasks) {
    await fs.ensureDir(DB_DIR);
    return fs.writeJson(TASKS_FILE, tasks, { spaces: 2 });
}

function nowIso() {
    return new Date().toISOString();
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.json({ service: 'Task Manager Dev Server', version: '1.0.0' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: nowIso() });
});

// List tasks
app.get('/api/tasks', async (req, res) => {
    const tasks = await readTasks();
    const userId = req.query.userId;
    // simple filter by userId if provided
    const filtered = userId ? tasks.filter(t => t.userId === userId) : tasks;
    res.json({ success: true, tasks: filtered, serverTime: Date.now() });
});

// Create task
app.post('/api/tasks', async (req, res) => {
    const payload = req.body;
    const tasks = await readTasks();
    const id = payload.id || uuidv4();
    const now = nowIso();
    const task = {
        id,
        title: payload.title || '',
        description: payload.description || '',
        priority: payload.priority || 'normal',
        userId: payload.userId || 'user1',
        category: payload.category || '',
        tags: payload.tags || '',
        completed: !!payload.completed,
        version: 1,
        createdAt: now,
        updatedAt: now
    };
    tasks.push(task);
    await writeTasks(tasks);
    res.status(201).json({ success: true, task });
});

// Update
app.put('/api/tasks/:id', async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    const tasks = await readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });

    // simple optimistic concurrency: if client sent version and it's older, return 409
    const existing = tasks[idx];
    if (body.version && body.version < existing.version) {
        return res.status(409).json({ success: false, serverTask: existing });
    }

    const now = nowIso();
    const updated = {
        ...existing,
        ...body,
        id: existing.id,
        version: (existing.version || 1) + 1,
        updatedAt: now
    };
    tasks[idx] = updated;
    await writeTasks(tasks);
    res.json({ success: true, task: updated });
});

// Delete
app.delete('/api/tasks/:id', async (req, res) => {
    const id = req.params.id;
    const tasks = await readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    tasks.splice(idx, 1);
    await writeTasks(tasks);
    res.json({ success: true });
});

// Batch sync endpoint: accepts operations {type, taskId, data}
app.post('/api/sync/batch', async (req, res) => {
    const { operations } = req.body;
    if (!Array.isArray(operations)) return res.status(400).json({ success: false, message: 'operations must be array' });
    const tasks = await readTasks();
    const results = [];

    for (const op of operations) {
        try {
            if (op.type === 'create') {
                const payload = op.data || {};
                const id = payload.id || uuidv4();
                const now = nowIso();
                const task = {
                    id,
                    title: payload.title || '',
                    description: payload.description || '',
                    priority: payload.priority || 'normal',
                    userId: payload.userId || 'user1',
                    category: payload.category || '',
                    tags: payload.tags || '',
                    completed: !!payload.completed,
                    version: 1,
                    createdAt: now,
                    updatedAt: now
                };
                tasks.push(task);
                results.push({ success: true, opId: op.id, type: 'create', id: task.id });
            } else if (op.type === 'update') {
                const idx = tasks.findIndex(t => t.id === op.taskId);
                if (idx === -1) {
                    results.push({ success: false, opId: op.id, type: 'update', message: 'not_found' });
                    continue;
                }
                const existing = tasks[idx];
                const payload = op.data || {};
                // conflict if client version < server
                if (payload.version && payload.version < (existing.version || 1)) {
                    results.push({ success: false, opId: op.id, type: 'update', conflict: true, serverTask: existing });
                    continue;
                }
                const now = nowIso();
                const updated = { ...existing, ...payload, version: (existing.version || 1) + 1, updatedAt: now };
                tasks[idx] = updated;
                results.push({ success: true, opId: op.id, type: 'update', id: updated.id });
            } else if (op.type === 'delete') {
                const idx = tasks.findIndex(t => t.id === op.taskId);
                if (idx === -1) {
                    results.push({ success: false, opId: op.id, type: 'delete', message: 'not_found' });
                    continue;
                }
                tasks.splice(idx, 1);
                results.push({ success: true, opId: op.id, type: 'delete', id: op.taskId });
            } else {
                results.push({ success: false, opId: op.id, message: 'unknown_op' });
            }
        } catch (e) {
            results.push({ success: false, opId: op.id, message: e.message });
        }
    }

    await writeTasks(tasks);
    res.json({ success: true, results });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Dev server listening on port ${PORT}`));
