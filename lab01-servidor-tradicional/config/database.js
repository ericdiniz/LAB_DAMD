module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui',
  jwtExpiration: '24h',
  rateLimit: { windowMs: 15*60*1000, max: 1000 }
};
