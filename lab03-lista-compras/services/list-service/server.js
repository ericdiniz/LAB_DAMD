const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const app = express();
const port = process.env.PORT || 3003;

// registra no service registry
registry.register('list-service', { url: `http://localhost:${port}` });

// usa sempre services/list-service/database/lists.json
const db = new JsonDatabase(path.join(__dirname, 'database'), 'lists');

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// health
app.get('/health', (req, res) => {
    res.json({ service: 'list-service', status: 'healthy' });
});

// listar todas as listas
app.get('/lists', async (req, res) => {
    const lists = await db.find({});
    res.json({ success: true, data: lists });
});

// buscar lista específica
app.get('/lists/:id', async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    res.json({ success: true, data: list });
});

// criar lista
app.post('/lists', async (req, res) => {
    const { name, description } = req.body;
    const list = await db.create({
        name,
        description,
        status: 'active',
        items: [],
        summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 }
    });
    res.json({ success: true, data: list });
});

// atualizar lista
app.put('/lists/:id', async (req, res) => {
    const { name, description } = req.body;
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    const updated = await db.update(req.params.id, { name, description });
    res.json({ success: true, data: updated });
});

// deletar lista
app.delete('/lists/:id', async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    await db.delete(req.params.id);
    res.json({ success: true });
});

// adicionar item
app.post('/lists/:id/items', async (req, res) => {
    const { itemId, itemName, quantity, unit, estimatedPrice, notes } = req.body;
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    const newItem = {
        itemId,
        itemName,
        quantity,
        unit,
        estimatedPrice,
        purchased: false,
        notes,
        addedAt: new Date()
    };
    list.items.push(newItem);

    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((acc, i) => acc + (i.estimatedPrice * i.quantity), 0);

    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// atualizar item
app.put('/lists/:id/items/:itemId', async (req, res) => {
    const { quantity, purchased, notes } = req.body;
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

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

// deletar item
app.delete('/lists/:id/items/:itemId', async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    list.items = list.items.filter(i => i.itemId !== req.params.itemId);
    list.summary.totalItems = list.items.length;
    list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
    list.summary.estimatedTotal = list.items.reduce((acc, i) => acc + (i.estimatedPrice * i.quantity), 0);

    const updated = await db.update(req.params.id, list);
    res.json({ success: true, data: updated });
});

// resumo
app.get('/lists/:id/summary', async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    res.json({ success: true, data: list.summary });
});

// busca
app.get('/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ success: false, message: 'Termo de busca obrigatório' });
    const results = await db.search(q, ['name', 'description']);
    res.json({ success: true, data: results });
});

app.listen(port, () => {
    console.log(`📋 List Service rodando na porta ${port}`);
});