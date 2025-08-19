const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validate('register'), async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;
    const existing = await database.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) return res.status(409).json({ success: false, message: 'Email ou username já existe' });
    const user = new User({ id: uuidv4(), email, username, password, firstName, lastName });
    await user.hashPassword();
    await database.run('INSERT INTO users (id, email, username, password, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.email, user.username, user.password, user.firstName, user.lastName]);
    const token = user.generateToken();
    res.status(201).json({ success: true, message: 'Usuário criado com sucesso', data: { user: user.toJSON(), token } });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

router.post('/login', validate('login'), async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const row = await database.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
    if (!row) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    const user = new User(row);
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    const token = user.generateToken();
    res.json({ success: true, message: 'Login realizado com sucesso', data: { user: user.toJSON(), token } });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

module.exports = router;
