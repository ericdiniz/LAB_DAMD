const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API = 'http://localhost:3000/api';

(async () => {
    try {
        // 1) Registro de usuário
        console.log('1) Registrando usuário...');
        const unique = uuidv4().slice(0, 6);
        const email = `demo${unique}@teste.com`;
        const username = `demo${unique}`;
        await axios.post(`${API}/auth/register`, {
            email,
            username,
            firstName: 'Demo',
            lastName: 'User',
            password: '123456'
        });
        console.log(`Usuário criado: ${email} / 123456`);

        // 2) Login
        console.log('2) Login...');
        const login = await axios.post(`${API}/auth/login`, {
            identifier: email,
            password: '123456'
        });
        const token = login.data.data.token;
        console.log('Token recebido:', token.slice(0, 20) + '...');

        // 3) Busca de itens
        console.log('3) Busca de itens...');
        let items = (await axios.get(`${API}/search?q=Arroz`)).data.items?.data || [];
        if (!items || items.length === 0) {
            console.log('Nenhum item encontrado com "Arroz", usando fallback...');
            const all = await axios.get(`${API}/items`);
            items = all.data.data || [];
        }
        if (!items.length) throw new Error('Nenhum item disponível no catálogo.');
        console.log(`Itens encontrados: ${items.length}`);
        const firstItem = items[0];

        // 4) Criação de lista
        console.log('4) Criando lista...');
        const lista = await axios.post(`${API}/lists`, {
            name: 'Compras Semanais',
            description: 'Itens básicos da semana'
        }, { headers: { Authorization: `Bearer ${token}` } });
        const listId = lista.data.data.id;
        console.log('Lista criada:', listId);

        // 5) Adição de item à lista
        console.log('5) Adicionando item à lista...');
        const added = await axios.post(`${API}/lists/${listId}/items`, {
            itemId: firstItem.id,
            itemName: firstItem.name,
            quantity: 2,
            unit: firstItem.unit,
            estimatedPrice: firstItem.averagePrice,
            notes: 'Adicionado pelo client-demo'
        });
        console.log('Item adicionado:', added.data.data.items.length, 'itens na lista');

        // 6) Dashboard
        console.log('6) Visualizando dashboard...');
        const dash = await axios.get(`${API}/dashboard`);
        console.log('Dashboard:', dash.data);

        console.log('\nFluxo demo concluído com sucesso!');
    } catch (err) {
        console.error('Erro no fluxo:', err.response?.data || err.message);
    }
})();