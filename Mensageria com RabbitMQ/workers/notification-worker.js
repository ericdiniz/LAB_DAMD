const rabbit = require('../shared/rabbitmq');

const exchange = process.env.SHOPPING_EVENTS_EXCHANGE || 'shopping_events';
const queue = process.env.NOTIFICATION_QUEUE || 'list.checkout.notifications';

async function start() {
    await rabbit.consume({
        exchange,
        queue,
        routingKeys: ['list.checkout.#'],
        onMessage: async (payload) => {
            const listId = payload.listId || 'desconhecido';
            const email = payload.userEmail || 'email não informado';
            console.log(`📨 Enviando comprovante da lista ${listId} para o usuário ${email}`);
        },
    });

    console.log('[notification-worker] aguardando mensagens...');
}

start().catch((err) => {
    console.error('[notification-worker] não foi possível iniciar', err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    await rabbit.close();
    process.exit(0);
});
