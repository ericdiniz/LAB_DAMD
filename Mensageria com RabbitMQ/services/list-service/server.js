const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');
const rabbit = require('../../shared/rabbitmq');

const app = express();
const port = process.env.PORT || 3003;
const checkoutExchange = process.env.SHOPPING_EVENTS_EXCHANGE || 'shopping_events';

// registra no service registry
registry.register('list-service', { url: `http://localhost:${port}` });

// usa sempre services/list-service/database/lists.json
const db = new JsonDatabase(path.join(__dirname, 'database'), 'lists');

async function resolveUserEmail(userId, userEmail) {
    if (userEmail) return userEmail;
    if (!userId) return null;
    try {
        const userService = registry.discover('user-service');
        const response = await axios.get(`${userService.url}/users/${userId}`, { timeout: 5000, family: 4 });
        return response.data?.data?.email || null;
    } catch (error) {
        console.warn('[checkout] Falha ao obter usuário', error.message);
        return null;
    }
}

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

app.post('/lists/:id/checkout', async (req, res) => {
    try {
        const list = await db.findById(req.params.id);
        if (!list) return res.status(404).json({ success: false, message: 'Lista não encontrada' });
        if (list.status === 'completed') {
            return res.status(409).json({ success: false, message: 'Checkout já realizado para esta lista' });
        }

        const completedAt = new Date();
        list.items = list.items.map((item) => ({
            ...item,
            purchased: true,
            purchasedAt: item.purchasedAt || completedAt.toISOString()
        }));

        const totalSpent = list.items.reduce((acc, item) => {
            const price = Number(item.estimatedPrice) || 0;
            const quantity = Number(item.quantity) || 0;
            return acc + price * quantity;
        }, 0);

        list.status = 'completed';
        list.summary = {
            ...list.summary,
            totalItems: list.items.length,
            purchasedItems: list.items.length,
            estimatedTotal: totalSpent,
            totalSpent,
            completedAt: completedAt.toISOString()
        };

        const userId = req.body?.userId || null;
        const userEmail = await resolveUserEmail(userId, req.body?.userEmail);
        const updated = await db.update(req.params.id, list);

        const eventPayload = {
            eventId: uuidv4(),
            eventType: 'list.checkout.completed',
            occurredAt: completedAt.toISOString(),
            listId: updated.id,
            listName: updated.name,
            userId,
            userEmail,
            itemCount: updated.items.length,
            totalSpent,
            currency: req.body?.currency || 'BRL',
            items: updated.items
        };

        await rabbit.publish(checkoutExchange, 'list.checkout.completed', eventPayload);

        res.status(202).json({
            success: true,
            message: 'Checkout recebido e enfileirado',
            data: {
                listId: updated.id,
                status: updated.status,
                checkoutEventId: eventPayload.eventId
            }
        });
    } catch (error) {
        console.error('[checkout] Falha ao publicar evento', error);
        res.status(500).json({ success: false, message: 'Erro ao processar checkout' });
    }
});

// busca
app.get('/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ success: false, message: 'Termo de busca obrigatório' });
    const results = await db.search(q, ['name', 'description']);
    res.json({ success: true, data: results });
});

rabbit.getChannel()
    .then(() => console.log('[RabbitMQ] Publisher conectado (list-service)'))
    .catch((err) => console.error('[RabbitMQ] Erro ao conectar publisher', err.message));

const server = app.listen(port, () => {
    console.log(`📋 List Service rodando na porta ${port}`);
});

process.on('SIGINT', async () => {
    await rabbit.close();
    server.close(() => process.exit(0));
});