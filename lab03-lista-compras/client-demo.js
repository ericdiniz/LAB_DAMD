const axios = require('axios');

const API = 'http://localhost:3000';

(async () => {
    try {
        console.log('1) Registrando usuário...');
        await axios.post(`${API}/api/auth/register`, {
            email: 'demo3@teste.com',
            username: 'demo3',
            password: '123456',
            firstName: 'Demo',
            lastName: 'User'
        });

        console.log('2) Login...');
        const loginRes = await axios.post(`${API}/api/auth/login`, {
            identifier: 'demo3@teste.com',
            password: '123456'
        });
        const token = loginRes.data.data.token;
        const auth = { headers: { Authorization: `Bearer ${token}` } };

        console.log('3) Busca de itens...');
        const items = await axios.get(`${API}/api/items?q=arroz`, auth);
        console.log('Itens encontrados:', items.data.data.map(i => i.name));

        console.log('4) Criando lista...');
        const listRes = await axios.post(`${API}/api/lists`, {
            name: 'Compras Semanais',
            description: 'Itens básicos da semana'
        }, auth);
        const listId = listRes.data.data.id;

        console.log('5) Adicionando item à lista...');
        await axios.post(`${API}/api/lists/${listId}/items`, {
            itemId: items.data.data[0].id,
            quantity: 2,
            notes: 'Comprar se estiver em promoção'
        }, auth);

        console.log('6) Dashboard...');
        const dashboard = await axios.get(`${API}/api/dashboard`, auth);
        console.log(dashboard.data);

        console.log('--- DEMONSTRAÇÃO FINALIZADA ---');
    } catch (err) {
        console.error('Erro:', err.response?.data || err.message);
    }
})();