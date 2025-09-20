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
    this.app.use((req, res, next) => { res.setHeader('X-Gateway', 'api-gateway'); next(); });

    // health & info
    this.app.get('/health', (req, res) => {
      const services = serviceRegistry.listServices();
      res.json({ service: 'api-gateway', status: 'healthy', services, serviceCount: Object.keys(services).length });
    });
    this.app.get('/', (req, res) => {
      res.json({
        service: 'API Gateway',
        endpoints: {
          auth: '/api/auth/*',
          users: '/api/users/*',
          items: '/api/items/*',
          lists: '/api/lists/*',
          dashboard: '/api/dashboard',
          search: '/api/search'
        },
        services: serviceRegistry.listServices()
      });
    });
    this.app.get('/registry', (req, res) => res.json({ success: true, services: serviceRegistry.listServices() }));

    // rotas para serviços
    this.app.use('/api/auth', (req, res, n) => this.proxy('user-service', req, res, n));
    this.app.use('/api/users', (req, res, n) => this.proxy('user-service', req, res, n));
    this.app.use('/api/items', (req, res, n) => this.proxy('item-service', req, res, n));
    this.app.use('/api/lists', (req, res, n) => this.proxy('list-service', req, res, n));

    // agregações simples
    this.app.get('/api/dashboard', async (req, res) => {
      try {
        const u = serviceRegistry.discover('user-service');
        const i = serviceRegistry.discover('item-service');
        const l = serviceRegistry.discover('list-service');
        const [uHealth, iHealth, lHealth] = await Promise.all([
          axios.get(`${u.url}/health`, { timeout: 5000, family: 4 }),
          axios.get(`${i.url}/health`, { timeout: 5000, family: 4 }),
          axios.get(`${l.url}/health`, { timeout: 5000, family: 4 })
        ]);
        res.json({ success: true, users: uHealth.data, items: iHealth.data, lists: lHealth.data });
      } catch (e) {
        res.status(503).json({ success: false, message: 'Falha ao agregar dashboard', error: e.message });
      }
    });

    this.app.get('/api/search', async (req, res) => {
      try {
        const q = req.query.q;
        if (!q) return res.status(400).json({ success: false, message: 'Parâmetro q obrigatório' });

        const itemSvc = serviceRegistry.discover('item-service');
        const listSvc = serviceRegistry.discover('list-service');

        const [items, lists] = await Promise.all([
          axios.get(`${itemSvc.url}/search?q=${encodeURIComponent(q)}`, { timeout: 5000, family: 4 }),
          axios.get(`${listSvc.url}/search?q=${encodeURIComponent(q)}`, { timeout: 5000, family: 4 })
        ]);

        res.json({ success: true, query: q, items: items.data, lists: lists.data });
      } catch (e) {
        res.status(503).json({ success: false, message: 'Falha na busca global', error: e.message });
      }
    });

    // 404 e erros
    this.app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Endpoint não encontrado', service: 'api-gateway' }));
    this.app.use((err, req, res, next) => { console.error('Gateway Error:', err); res.status(500).json({ success: false, message: 'Erro interno do gateway' }); });

    // inicia health checks após subir
    setTimeout(() => this.startHealthChecks(), 3000);
  }

  isCircuitOpen(name) {
    const cb = this.circuitBreakers.get(name);
    return cb && cb.open && Date.now() < cb.until;
  }
  recordFailure(name) {
    const cb = this.circuitBreakers.get(name) || { fail: 0, open: false, until: 0 };
    cb.fail++;
    if (cb.fail >= 3) {
      cb.open = true;
      cb.until = Date.now() + 30000;
    }
    this.circuitBreakers.set(name, cb);
  }
  resetCircuit(name) {
    this.circuitBreakers.set(name, { fail: 0, open: false, until: 0 });
  }

  buildTargetPath(serviceName, original) {
    let path = original;
    if (serviceName === 'user-service') {
      if (original.startsWith('/api/auth')) {
        path = original.replace('/api/auth', '/auth');
      } else if (original.startsWith('/api/users')) {
        path = original.replace('/api/users', '/users');
      }
    }
    if (serviceName === 'item-service') {
      path = original.replace('/api/items', '') || '/items';
    }
    if (serviceName === 'list-service') {
      path = original.replace('/api/lists', '') || '/lists';
    }
    if (!path.startsWith('/')) path = '/' + path;
    return path;
  }

  async proxy(serviceName, req, res) {
    try {
      if (this.isCircuitOpen(serviceName)) {
        return res.status(503).json({ success: false, message: `${serviceName} indisponível (circuit open)` });
      }
      const svc = serviceRegistry.discover(serviceName);
      const url = `${svc.url}${this.buildTargetPath(serviceName, req.originalUrl)}`;

      const cfg = {
        method: req.method,
        url,
        headers: { ...req.headers },
        timeout: 10000,
        family: 4,
        validateStatus: s => s < 500
      };
      delete cfg.headers.host;
      delete cfg.headers['content-length'];
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) cfg.data = req.body;
      if (Object.keys(req.query || {}).length) cfg.params = req.query;

      const r = await axios(cfg);
      this.resetCircuit(serviceName);
      res.status(r.status).json(r.data);
    } catch (e) {
      this.recordFailure(serviceName);
      if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') {
        return res.status(503).json({ success: false, message: `${serviceName} indisponível`, error: e.code });
      }
      const status = e.response?.status || 500;
      res.status(status).json({ success: false, message: e.message });
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