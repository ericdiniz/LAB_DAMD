const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const JsonDatabase = require('../../shared/JsonDatabase');
const authMiddleware = require('../../shared/authMiddleware');

const app = express();
const port = process.env.PORT || 3003;

const db = new JsonDatabase('lists');

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// health
app.get('/health', (req, res) => {
    res.json({ service: 'list-service', status: 'healthy' });
});

// listar todas as listas do usuário autenticado
app.get('/lists', authMiddleware, async (req, res) => {
    const lists = await db.find({ userId: req.user.id });
    res.json({ success: true, data: lists });
});

// buscar lista específica
app.get('/lists/:id', authMiddleware, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    res.json({ success: true, data: list });
});

// criar lista
app.post('/lists', authMiddleware, async (req, res) => {
    const { name, description } = req.body;
    const list = await db.insert({
        userId: req.user.id,
        name,
        description,
        status: 'active',
        items: [],
        summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
    });
    res.json({ success: true, data: list });
});

// atualizar lista
app.put('/lists/:id', authMiddleware, async (req, res) => {
    const { name, description } = req.body;
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    const updated = await db.update(req.params.id, { name, description, updatedAt: new Date() });
    res.json({ success: true, data: updated });
});

// deletar lista
app.delete('/lists/:id', authMiddleware, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    await db.delete(req.params.id);
    res.json({ success: true });
});

// adicionar item na lista
app.post('/lists/:id/items', authMiddleware, async (req, res) => {
    const { itemId, quantity, notes } = req.body;
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    const newItem = {
        itemId,
        itemName: req.body.itemName || '',
        quantity,
        unit: req.body.unit || '',
        estimatedPrice: req.body.estimatedPrice || 0,
        purchased: false,
        notes: notes || '',
        addedAt: new Date()
    };
    list.items.push(newItem);
    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((acc, i) => acc + (i.estimatedPrice * i.quantity), 0);
    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// atualizar item na lista
app.put('/lists/:id/items/:itemId', authMiddleware, async (req, res) => {
    const { quantity, purchased, notes } = req.body;
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    const item = list.items.find(i => i.itemId === req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado' });

    if (quantity !== undefined) item.quantity = quantity;
    if (purchased !== undefined) item.purchased = purchased;
    if (notes !== undefined) item.notes = notes;

    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((acc, i) => acc + (i.estimatedPrice * i.quantity), 0);

    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// remover item da lista
app.delete('/lists/:id/items/:itemId', authMiddleware, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    list.items = list.items.filter(i => i.itemId !== req.params.itemId);
    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((acc, i) => acc + (i.estimatedPrice * i.quantity), 0);
    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// resumo da lista
app.get('/lists/:id/summary', authMiddleware, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    res.json({ success: true, data: list.summary });
});

// 🔎 busca dentro das listas (SEM autenticação)
app.get('/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ success: false, message: 'Termo de busca obrigatório' });
    const regex = new RegExp(q, 'i');
    const lists = await db.find({});
    const filtered = lists.filter(l => regex.test(l.name) || regex.test(l.description));
    res.json({ success: true, data: filtered });
});

app.listen(port, () => {
    console.log(`📋 List Service rodando na porta ${port}`);
});