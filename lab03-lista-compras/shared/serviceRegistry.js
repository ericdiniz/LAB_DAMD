const fs = require('fs');
const path = require('path');
const axios = require('axios');

class FileRegistry {
  constructor() {
    this.registryFile = path.join(__dirname, 'services-registry.json');
    if (!fs.existsSync(this.registryFile)) {
      fs.writeFileSync(this.registryFile, '{}');
    }
  }

  read() {
    try {
      return JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
    } catch {
      return {};
    }
  }

  write(obj) {
    fs.writeFileSync(this.registryFile, JSON.stringify(obj, null, 2));
  }

  register(name, info) {
    const services = this.read();
    services[name] = {
      ...info,
      healthy: true,
      registeredAt: Date.now(),
      pid: process.pid,
    };
    this.write(services);
  }

  unregister(name) {
    const services = this.read();
    delete services[name];
    this.write(services);
  }

  discover(name) {
    const services = this.read();
    if (!services[name]) throw new Error(`Serviço não encontrado: ${name}`);
    if (!services[name].healthy)
      throw new Error(`Serviço indisponível: ${name}`);
    return services[name];
  }

  listServices() {
    const services = this.read();
    const out = {};
    Object.entries(services).forEach(([n, i]) => {
      out[n] = { url: i.url, healthy: i.healthy, pid: i.pid };
    });
    return out;
  }

  updateHealth(name, healthy) {
    const services = this.read();
    if (services[name]) {
      services[name].healthy = healthy;
      services[name].lastHealthCheck = Date.now();
      this.write(services);
    }
  }

  async performHealthChecks() {
    const services = this.read();
    for (const [name, info] of Object.entries(services)) {
      try {
        await axios.get(`${info.url}/health`, { timeout: 4000, family: 4 });
        this.updateHealth(name, true);
      } catch {
        this.updateHealth(name, false);
      }
    }
  }
}

const registry = new FileRegistry();

// Cleanup automático no exit
process.on('exit', () => {
  try {
    const services = registry.read();
    const serviceNames = Object.keys(services);
    serviceNames.forEach((name) => {
      if (services[name].pid === process.pid) {
        registry.unregister(name);
      }
    });
  } catch {
    // ignora erros no cleanup
  }
});

module.exports = registry;