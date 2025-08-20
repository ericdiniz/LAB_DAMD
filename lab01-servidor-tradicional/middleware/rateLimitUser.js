const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const userLimiter = rateLimit({
  windowMs: 60 * 1000,          // janela de 60s
  max: 120,                     // até 120 req por janela
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Se autenticado, limita por usuário; senão, usa o helper correto para IP/IPv6
    if (req.user && req.user.id) return `u:${req.user.id}`;
    return ipKeyGenerator(req, res);
  }
});

module.exports = { userLimiter };
