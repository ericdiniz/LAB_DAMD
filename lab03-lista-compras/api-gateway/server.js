const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const serviceRegistry = require('../shared/serviceRegistry');

class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.circuitBreakers = new Map();

    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(morgan('combined'));
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.setHeader('X-Gateway', 'api-gateway');
      next();
    });

    // health
    this.app.get('/health', (req, res) => {
      const services = serviceRegistry.listServices();
      res.json({ service: 'api-gateway', status: 'healthy', services });
    });

    // rotas encaminhadas
    this.app.use('/api/users', (req, res, n) => this.proxy('user-service', req, res, n));

    // fallback
    this.app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Endpoint não encontrado', service: 'api-gateway' }));

    setTimeout(() => this.startHealthChecks(), 3000);
  }

  buildTargetPath(serviceName, original) {
    if (serviceName === 'user-service') {
      if (original.startsWith('/api/users')) {
        return original.replace('/api/users', '/users');
      }
      if (original.startsWith('/api/auth')) {
        return original.replace('/api/auth', '/auth');
      }
    }
    if (serviceName === 'product-service') {
      if (original.startsWith('/api/products')) {
        return original.replace('/api/products', '/products');
      } c
    }
    return original;
  }

  async proxy(serviceName, req, res) {
    try {
      const svc = serviceRegistry.discover(serviceName);
      const url = `${svc.url}${this.buildTargetPath(serviceName, req.originalUrl)}`;
      const cfg = {
        method: req.method,
        url,
        headers: { ...req.headers },
        timeout: 10000,
        validateStatus: s => s < 500
      };
      delete cfg.headers.host;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) cfg.data = req.body;
      if (Object.keys(req.query || {}).length) cfg.params = req.query;

      const r = await axios(cfg);
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(503).json({ success: false, message: `${serviceName} indisponível`, error: e.message });
    }
  }

  async startHealthChecks() {
    setInterval(() => serviceRegistry.performHealthChecks(), 30000);
  }

  start() {
    this.app.listen(this.port, () => console.log(`🚪 API Gateway na porta ${this.port}`));
  }
}

new APIGateway().start();