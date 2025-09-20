const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
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

// --- Middleware de autenticação (valida no user-service) ---
async function auth(req, res, next) {
    const h = req.header('Authorization') || '';
    if (!h.startsWith('Bearer '))
        return res.status(401).json({ success: false, message: 'token ausente' });

    try {
        const user = registry.discover('user-service');
        const r = await axios.post(
            `${user.url}/auth/validate`,
            { token: h.replace('Bearer ', '') },
            { timeout: 4000, family: 4 }
        );
        if (r.data?.success) {
            req.user = r.data.data.user;
            return next();
        }
        return res.status(401).json({ success: false, message: 'token inválido' });
    } catch (e) {
        return res
            .status(503)
            .json({ success: false, message: 'auth indisponível' });
    }
}

// --- Função utilitária: calcular resumo ---
function calcularResumo(lista) {
    const totalItems = lista.items.length;
    const purchasedItems = lista.items.filter((i) => i.purchased).length;
    const estimatedTotal = lista.items.reduce(
        (acc, i) => acc + (i.estimatedPrice || 0) * (i.quantity || 1),
        0
    );
    lista.summary = { totalItems, purchasedItems, estimatedTotal };
    return lista;
}

// --- Endpoints ---

// Criar nova lista
app.post('/lists', auth, async (req, res) => {
    const { name, description } = req.body;
    if (!name)
        return res
            .status(400)
            .json({ success: false, message: 'nome obrigatório' });

    const nova = {
        id: uuidv4(),
        userId: req.user.id,
        name,
        description: description || '',
        status: 'active',
        items: [],
        summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await db.create(nova);
    res.status(201).json({ success: true, data: nova });
});

// Listar listas do usuário
app.get('/lists', auth, async (req, res) => {
    const listas = await db.find({ userId: req.user.id });
    res.json({ success: true, data: listas });
});

// Buscar lista específica
app.get('/lists/:id', auth, async (req, res) => {
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    res.json({ success: true, data: lista });
});

// Atualizar lista
app.put('/lists/:id', auth, async (req, res) => {
    const { name, description, status } = req.body;
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    updates.updatedAt = new Date();

    const updated = await db.update(req.params.id, updates);
    res.json({ success: true, data: updated });
});

// Deletar lista
app.delete('/lists/:id', auth, async (req, res) => {
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    await db.delete(req.params.id);
    res.json({ success: true, message: 'Lista deletada' });
});

// Adicionar item à lista
app.post('/lists/:id/items', auth, async (req, res) => {
    const { itemId, quantity, notes } = req.body;
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    try {
        const itemService = registry.discover('item-service');
        const r = await axios.get(`${itemService.url}/items/${itemId}`);
        if (!r.data?.success)
            return res.status(404).json({ success: false, message: 'Item não encontrado' });

        const item = r.data.data;
        const novoItem = {
            itemId,
            itemName: item.name,
            quantity: quantity || 1,
            unit: item.unit,
            estimatedPrice: item.averagePrice,
            purchased: false,
            notes: notes || '',
            addedAt: new Date(),
        };
        lista.items.push(novoItem);
        calcularResumo(lista);
        await db.update(lista.id, lista);
        res.status(201).json({ success: true, data: lista });
    } catch (e) {
        return res
            .status(503)
            .json({ success: false, message: 'item-service indisponível' });
    }
});

// Atualizar item na lista
app.put('/lists/:id/items/:itemId', auth, async (req, res) => {
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    const item = lista.items.find((i) => i.itemId === req.params.itemId);
    if (!item)
        return res.status(404).json({ success: false, message: 'Item não encontrado na lista' });

    const { quantity, purchased, notes } = req.body;
    if (quantity !== undefined) item.quantity = quantity;
    if (purchased !== undefined) item.purchased = purchased;
    if (notes !== undefined) item.notes = notes;
    lista.updatedAt = new Date();
    calcularResumo(lista);
    await db.update(lista.id, lista);
    res.json({ success: true, data: lista });
});

// Remover item da lista
app.delete('/lists/:id/items/:itemId', auth, async (req, res) => {
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    lista.items = lista.items.filter((i) => i.itemId !== req.params.itemId);
    lista.updatedAt = new Date();
    calcularResumo(lista);
    await db.update(lista.id, lista);
    res.json({ success: true, data: lista });
});

// Resumo da lista
app.get('/lists/:id/summary', auth, async (req, res) => {
    const lista = (await db.find({ id: req.params.id, userId: req.user.id }))[0];
    if (!lista)
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });

    calcularResumo(lista);
    res.json({ success: true, data: lista.summary });
});

// Health
app.get('/health', async (req, res) => {
    res.json({ service: 'list-service', status: 'healthy', count: await db.count() });
});

app.listen(PORT, () => {
    console.log(`📝 list-service na porta ${PORT}`);
    registry.register('list-service', { url: `http://127.0.0.1:${PORT}` });
});