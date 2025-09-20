const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const PORT = process.env.PORT || 3003;
const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const db = new JsonDatabase(path.join(__dirname, 'database'), 'lists');

// middleware de auth validando no user-service
async function auth(req, res, next) {
    const h = req.header('Authorization') || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'token ausente' });
    try {
        const user = registry.discover('user-service');
        const r = await axios.post(`${user.url}/auth/validate`, { token: h.replace('Bearer ', '') }, { timeout: 4000, family: 4 });
        if (r.data?.success) { req.user = r.data.data.user; return next(); }
        return res.status(401).json({ success: false, message: 'token inválido' });
    } catch (e) { return res.status(503).json({ success: false, message: 'auth indisponível' }); }
}

// cria nova lista
app.post('/lists', auth, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'nome obrigatório' });
    const newList = {
        id: uuidv4(),
        userId: req.user.id,
        name,
        description: description || '',
        status: 'active',
        items: [],
        summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const created = await db.create(newList);
    res.status(201).json({ success: true, data: created });
});

// listar listas do usuário
app.get('/lists', auth, async (req, res) => {
    const lists = await db.find({ userId: req.user.id });
    res.json({ success: true, data: lists });
});

// buscar lista específica
app.get('/lists/:id', auth, async (req, res) => {
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    res.json({ success: true, data: list });
});

// atualizar lista
app.put('/lists/:id', auth, async (req, res) => {
    const { name, description, status } = req.body;
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    const updated = await db.update(req.params.id, {
        ...(name && { name }),
        ...(description && { description }),
        ...(status && { status }),
        updatedAt: new Date()
    });
    res.json({ success: true, data: updated });
});

// deletar lista
app.delete('/lists/:id', auth, async (req, res) => {
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    if (!lists[0]) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    await db.delete(req.params.id);
    res.json({ success: true });
});

// adicionar item à lista
app.post('/lists/:id/items', auth, async (req, res) => {
    const { itemId, quantity, notes } = req.body;
    if (!itemId || !quantity) return res.status(400).json({ success: false, message: 'itemId e quantidade obrigatórios' });

    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    try {
        const itemService = registry.discover('item-service');
        const r = await axios.get(`${itemService.url}/items/${itemId}`);
        if (!r.data.success) return res.status(404).json({ success: false, message: 'Item não encontrado' });

        const itemData = r.data.data;
        const newItem = {
            itemId,
            itemName: itemData.name,
            quantity,
            unit: itemData.unit || '',
            estimatedPrice: (itemData.averagePrice || 0) * quantity,
            purchased: false,
            notes: notes || '',
            addedAt: new Date()
        };

        list.items.push(newItem);
        list.summary.totalItems = list.items.length;
        list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
        list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + i.estimatedPrice, 0);
        list.updatedAt = new Date();

        const updated = await db.update(req.params.id, list);
        res.status(201).json({ success: true, data: updated });
    } catch (e) {
        return res.status(503).json({ success: false, message: 'item-service indisponível' });
    }
});

// atualizar item na lista
app.put('/lists/:id/items/:itemId', auth, async (req, res) => {
    const { quantity, purchased, notes } = req.body;
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    const item = list.items.find(i => i.itemId === req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado na lista' });

    if (quantity !== undefined) item.quantity = quantity;
    if (purchased !== undefined) item.purchased = purchased;
    if (notes !== undefined) item.notes = notes;
    item.estimatedPrice = (item.estimatedPrice / item.quantity) * item.quantity; // recalcula
    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + i.estimatedPrice, 0);
    list.updatedAt = new Date();

    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// remover item da lista
app.delete('/lists/:id/items/:itemId', auth, async (req, res) => {
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    list.items = list.items.filter(i => i.itemId !== req.params.itemId);
    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + i.estimatedPrice, 0);
    list.updatedAt = new Date();

    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// resumo da lista
app.get('/lists/:id/summary', auth, async (req, res) => {
    const lists = await db.find({ id: req.params.id, userId: req.user.id });
    const list = lists[0];
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    res.json({ success: true, data: list.summary });
});

// health check
app.get('/health', async (req, res) => {
    res.json({ service: 'list-service', status: 'healthy', count: await db.count() });
});

app.listen(PORT, () => {
    console.log(`📝 list-service na porta ${PORT}`);
    registry.register('list-service', { url: `http://127.0.0.1:${PORT}` });
});