const jwt = require('jsonwebtoken');
const config = require('../config/database');

const authMiddleware = (req, res, next) => {
  const h = req.header('Authorization');
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Token de acesso obrigatório' });
  const token = h.slice(7);
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token inválido' });
  }
};
module.exports = { authMiddleware };
