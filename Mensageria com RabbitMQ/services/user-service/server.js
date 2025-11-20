const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'user-service-secret';

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan('dev')); app.use(express.json());

const db = new JsonDatabase(path.join(__dirname, 'database'), 'users');

// seed admin
(async () => {
  const users = await db.find();
  if (users.length === 0) {
    const pass = await bcrypt.hash('admin123', 12);
    await db.create({ id: uuidv4(), email: 'admin@micro.com', username: 'admin', password: pass, firstName: 'Admin', lastName: 'Root', role: 'admin', status: 'active' });
    console.log('👤 admin criado: admin@micro.com / admin123');
  }
})();

app.get('/health', async (req, res) => res.json({ service: 'user-service', status: 'healthy', users: await db.count() }));
app.get('/', (req, res) => res.json({ service: 'user-service', endpoints: ['POST /auth/register', 'POST /auth/login', 'POST /auth/validate', 'GET /users', 'GET /users/:id', 'PUT /users/:id'] }));

app.post('/auth/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;
    if (!email || !username || !password) return res.status(400).json({ success: false, message: 'Campos obrigatórios' });
    const exists = await db.find({ email: email.toLowerCase() });
    if (exists.length) return res.status(409).json({ success: false, message: 'Email já em uso' });
    const pass = await bcrypt.hash(password, 12);
    const user = await db.create({ id: uuidv4(), email: email.toLowerCase(), username: username.toLowerCase(), password: pass, firstName, lastName, role: 'user', status: 'active' });
    const { password: _, ...safe } = user;
    const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, data: { user: safe, token } });
  } catch (e) { res.status(500).json({ success: false, message: 'erro interno' }); }
});

app.post('/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ success: false, message: 'credenciais obrigatórias' });
  const user = (await db.find({ email: identifier.toLowerCase() }))[0] || (await db.find({ username: identifier.toLowerCase() }))[0];
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'inválido' });
  const { password: _, ...safe } = user;
  const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { user: safe, token } });
});

app.post('/auth/validate', async (req, res) => {
  try {
    const { token } = req.body; if (!token) return res.status(400).json({ success: false, message: 'token obrigatório' });
    const dec = jwt.verify(token, JWT_SECRET); const user = await db.findById(dec.id);
    if (!user) return res.status(401).json({ success: false, message: 'inválido' });
    const { password: _, ...safe } = user;
    res.json({ success: true, data: { user: safe } });
  } catch { res.status(401).json({ success: false, message: 'inválido' }); }
});

function auth(req, res, next) {
  const h = req.header('Authorization') || ''; if (!h.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'token ausente' });
  try { req.user = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET); next(); } catch { res.status(401).json({ success: false, message: 'token inválido' }); }
}

app.get('/users', auth, async (req, res) => {
  const users = await db.find({}, { limit: 50, sort: { createdAt: -1 } });
  res.json({ success: true, data: users.map(u => { const { password, ...s } = u; return s; }) });
});

app.get('/users/:id', auth, async (req, res) => {
  const { id } = req.params;
  const user = await db.findById(id);
  if (!user) return res.status(404).json({ success: false, message: 'não encontrado' });
  const { password, ...safe } = user;
  res.json({ success: true, data: safe });
});

app.put('/users/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'não encontrado' });

    const { firstName, lastName, email, username, preferences } = req.body;
    const updates = { updatedAt: new Date().toISOString() };

    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (username !== undefined) updates.username = username.toLowerCase();

    if (email !== undefined) {
      const emailLower = email.toLowerCase();
      const conflict = (await db.find({ email: emailLower }))[0];
      if (conflict && conflict.id !== id) {
        return res.status(409).json({ success: false, message: 'Email já em uso' });
      }
      updates.email = emailLower;
    }

    if (preferences !== undefined) updates.preferences = preferences;

    const updated = await db.update(id, updates);
    const { password, ...safe } = updated;
    res.json({ success: true, data: safe });
  } catch (e) {
    res.status(500).json({ success: false, message: 'erro interno' });
  }
});

app.listen(PORT, () => {
  console.log(`👤 user-service na porta ${PORT}`);
  registry.register('user-service', { url: `http://127.0.0.1:${PORT}` });
});
