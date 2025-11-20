const amqp = require('amqplib');

const DEFAULT_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const RETRY_DELAY = Number(process.env.RABBITMQ_RETRY_MS || 5000);

class RabbitMQClient {
    constructor(url = DEFAULT_URL) {
        this.url = url;
        this.connection = null;
        this.channel = null;
        this.connecting = null;
    }

    async #createChannel() {
        const conn = await amqp.connect(this.url);
        conn.on('error', (err) => {
            console.error('[RabbitMQ] Connection error', err.message);
            this.connection = null;
            this.channel = null;
            this.connecting = null;
        });
        conn.on('close', () => {
            console.warn('[RabbitMQ] Connection closed, retrying...');
            this.connection = null;
            this.channel = null;
            this.connecting = null;
            setTimeout(() => this.getChannel().catch(() => { }), RETRY_DELAY);
        });

        const channel = await conn.createConfirmChannel();
        channel.on('error', (err) => {
            console.error('[RabbitMQ] Channel error', err.message);
        });
        channel.on('close', () => {
            console.warn('[RabbitMQ] Channel closed');
            this.channel = null;
        });

        this.connection = conn;
        this.channel = channel;
        return channel;
    }

    async getChannel() {
        if (this.channel) return this.channel;
        if (!this.connecting) {
            this.connecting = this.#createChannel().catch((err) => {
                this.connecting = null;
                console.error('[RabbitMQ] Failed to connect:', err.message);
                setTimeout(() => this.getChannel().catch(() => { }), RETRY_DELAY);
                throw err;
            });
        }
        return this.connecting;
    }

    async publish(exchange, routingKey, payload, options = {}) {
        const channel = await this.getChannel();
        await channel.assertExchange(exchange, 'topic', { durable: true });
        const buffer = Buffer.from(JSON.stringify(payload));
        const published = channel.publish(exchange, routingKey, buffer, {
            contentType: 'application/json',
            persistent: true,
            timestamp: Date.now(),
            ...options,
        });
        if (channel.waitForConfirms) {
            await channel.waitForConfirms();
        } else if (!published) {
            console.warn('[RabbitMQ] publish backlog detected, message buffered');
        }
    }

    async consume({ exchange, queue, routingKeys, onMessage, queueOptions = {} }) {
        const channel = await this.getChannel();
        await channel.assertExchange(exchange, 'topic', { durable: true });
        const { prefetch, ...assertOptions } = queueOptions;
        const assertedQueue = await channel.assertQueue(queue, {
            durable: true,
            ...assertOptions,
        });
        if (prefetch) {
            await channel.prefetch(prefetch);
        }
        const keys = Array.isArray(routingKeys) ? routingKeys : [routingKeys];
        for (const key of keys) {
            await channel.bindQueue(assertedQueue.queue, exchange, key);
        }

        await channel.consume(assertedQueue.queue, async (msg) => {
            if (!msg) return;
            try {
                const data = JSON.parse(msg.content.toString());
                await Promise.resolve(onMessage(data, msg));
                channel.ack(msg);
            } catch (err) {
                console.error('[RabbitMQ] Error handling message', err);
                channel.nack(msg, false, false);
            }
        });

        console.log(`[RabbitMQ] Consuming queue ${assertedQueue.queue} (${keys.join(', ')})`);
    }

    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
        } catch (err) {
            console.error('[RabbitMQ] Error closing channel', err.message);
        }
        try {
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
        } catch (err) {
            console.error('[RabbitMQ] Error closing connection', err.message);
        }
        this.connecting = null;
    }
}

module.exports = new RabbitMQClient();
module.exports.RabbitMQClient = RabbitMQClient;
