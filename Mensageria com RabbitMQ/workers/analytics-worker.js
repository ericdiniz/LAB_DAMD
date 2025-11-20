const rabbit = require('../shared/rabbitmq');

const exchange = process.env.SHOPPING_EVENTS_EXCHANGE || 'shopping_events';
const queue = process.env.ANALYTICS_QUEUE || 'list.checkout.analytics';

function calculateTotal(items = []) {
    return items.reduce((acc, item) => {
        const price = Number(item.estimatedPrice) || 0;
        const quantity = Number(item.quantity) || 0;
        return acc + price * quantity;
    }, 0);
}

async function start() {
    await rabbit.consume({
        exchange,
        queue,
        routingKeys: ['list.checkout.#'],
        onMessage: async (payload) => {
            const totalRaw = typeof payload.totalSpent === 'number' ? payload.totalSpent : calculateTotal(payload.items);
            const total = Number.isFinite(totalRaw) ? totalRaw : 0;
            const itemCount = payload.itemCount ?? (payload.items ? payload.items.length : 0);
            console.log(`📊 Atualizando dashboard da lista ${payload.listId}: ${itemCount} itens, total estimado R$ ${total.toFixed(2)}`);
        },
    });

    console.log('[analytics-worker] aguardando mensagens...');
}

start().catch((err) => {
    console.error('[analytics-worker] não foi possível iniciar', err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    await rabbit.close();
    process.exit(0);
});
