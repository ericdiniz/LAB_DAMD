const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const PORT = process.env.PORT || 3002;
const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const db = new JsonDatabase(path.join(__dirname, 'database'), 'items');

// seed
(async () => {
  if ((await db.count()) === 0) {
    const seeds = [
      { name: 'Arroz Integral', category: { name: 'Alimentos', slug: 'alimentos' }, brand: 'Tio João', unit: 'kg', averagePrice: 7.99, barcode: '7891234567890', description: 'Arroz integral orgânico', active: true, createdAt: new Date() },
      { name: 'Feijão Preto', category: { name: 'Alimentos', slug: 'alimentos' }, brand: 'Camil', unit: 'kg', averagePrice: 6.49, barcode: '7891234567891', description: 'Feijão preto tradicional', active: true, createdAt: new Date() },
      { name: 'Detergente Líquido', category: { name: 'Limpeza', slug: 'limpeza' }, brand: 'Ypê', unit: 'un', averagePrice: 2.99, barcode: '7891234567892', description: 'Detergente para louças', active: true, createdAt: new Date() },
      { name: 'Álcool Gel', category: { name: 'Limpeza', slug: 'limpeza' }, brand: 'Álcool 70%', unit: 'un', averagePrice: 5.50, barcode: '7891234567893', description: 'Álcool em gel 70%', active: true, createdAt: new Date() },
      { name: 'Sabonete Líquido', category: { name: 'Higiene', slug: 'higiene' }, brand: 'Dove', unit: 'un', averagePrice: 8.99, barcode: '7891234567894', description: 'Sabonete líquido hidratante', active: true, createdAt: new Date() }
    ];
    for (const item of seeds) {
      await db.create({ id: uuidv4(), ...item });
    }
    console.log('📦 items seeds criados');
  }
})();

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

// GET /items with pagination and filters (category and name)
app.get('/items', async (req, res) => {
  const { page = 1, limit = 10, category, name } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const filter = { active: true };
  if (category) filter['category.slug'] = category;
  if (name) filter['name'] = new RegExp(name, 'i');
  const items = await db.find(filter, { skip, limit: parseInt(limit), sort: { createdAt: -1 } });
  res.json({ success: true, data: items, pagination: { page: parseInt(page), limit: parseInt(limit) } });
});

// GET /items/:id
app.get('/items/:id', async (req, res) => {
  const items = await db.find({ id: req.params.id, active: true });
  const item = items[0];
  if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado' });
  res.json({ success: true, data: item });
});

// POST /items (auth required)
app.post('/items', auth, async (req, res) => {
  const { name, category, brand, unit, averagePrice, barcode, description } = req.body;
  if (!name || !category || !category.name || !category.slug) return res.status(400).json({ success: false, message: 'nome e categoria obrigatórios' });
  const newItem = {
    id: uuidv4(),
    name,
    category,
    brand: brand || '',
    unit: unit || '',
    averagePrice: parseFloat(averagePrice) || 0,
    barcode: barcode || '',
    description: description || '',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const created = await db.create(newItem);
  res.status(201).json({ success: true, data: created });
});

// PUT /items/:id (auth required)
app.put('/items/:id', auth, async (req, res) => {
  const items = await db.find({ id: req.params.id, active: true });
  const item = items[0];
  if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado' });
  const { name, category, brand, unit, averagePrice, barcode, description, active } = req.body;
  const updatedData = {};
  if (name !== undefined) updatedData.name = name;
  if (category !== undefined && category.name && category.slug) updatedData.category = category;
  if (brand !== undefined) updatedData.brand = brand;
  if (unit !== undefined) updatedData.unit = unit;
  if (averagePrice !== undefined) updatedData.averagePrice = parseFloat(averagePrice);
  if (barcode !== undefined) updatedData.barcode = barcode;
  if (description !== undefined) updatedData.description = description;
  if (active !== undefined) updatedData.active = active;
  updatedData.updatedAt = new Date();
  const updated = await db.update(req.params.id, updatedData);
  res.json({ success: true, data: updated });
});

// GET /categories
app.get('/categories', async (req, res) => {
  const items = await db.find({ active: true });
  const categoriesMap = {};
  items.forEach(item => {
    const cat = item.category;
    if (cat && cat.slug && cat.name) {
      categoriesMap[cat.slug] = cat.name;
    }
  });
  const categories = Object.entries(categoriesMap).map(([slug, name]) => ({ slug, name }));
  res.json({ success: true, data: categories });
});

// GET /search?q=termo
app.get('/search', async (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.status(400).json({ success: false, message: 'Termo de busca obrigatório' });
  const regex = new RegExp(q, 'i');
  const items = await db.find({ active: true });
  const filtered = items.filter(i => regex.test(i.name) || regex.test(i.description));
  res.json({ success: true, data: filtered });
});

// Health check route
app.get('/health', async (req, res) => {
  res.json({ service: 'item-service', status: 'healthy', count: await db.count() });
});

app.listen(PORT, () => {
  console.log(`📦 item-service na porta ${PORT}`);
  registry.register('item-service', { url: `http://127.0.0.1:${PORT}` });
});