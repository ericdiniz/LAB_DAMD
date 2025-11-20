const registry = require('./serviceRegistry');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services-registry.json');

// Limpar antes dos testes
function reset() {
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}');
    }
}

(async () => {
    console.log('--- INICIANDO TESTES DO SERVICE REGISTRY ---');
    reset();

    // 1. Registrar um serviço
    registry.register('user-service', { url: 'http://localhost:3001' });
    let list = registry.listServices();
    console.log('Após registrar user-service:', list);

    // 2. Descobrir o serviço
    const discovered = registry.discover('user-service');
    console.log('Descoberto user-service:', discovered);

    // 3. Atualizar health para false
    registry.updateHealth('user-service', false);
    list = registry.listServices();
    console.log('Após updateHealth(false):', list);

    // 4. Testar performHealthChecks (vai tentar GET /health)
    console.log('Executando health checks...');
    await registry.performHealthChecks();
    list = registry.listServices();
    console.log('Após health check:', list);

    // 5. Unregister
    registry.unregister('user-service');
    list = registry.listServices();
    console.log('Após unregister:', list);

    console.log('--- FIM DOS TESTES ---');
})();