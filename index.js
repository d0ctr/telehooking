const dotenv = require('dotenv');
const Redis = require('ioredis');
const DiscordClient = require('./discord');
const TelegramClient = require('./telegram');
const API = require('./api');
const { createLogger, format, transports } = require('winston');

dotenv.config();

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.printf(options => {
            return `${options.timestamp} - ${options.module} - ${options.level} - ${options.level === 'error' ? options.message : options.message.replace(/\n/gm, '\\n')}`;
        })
    ),
    transports: [new transports.Console()]
});

function main() {
    let app = {};

    app.health = {
        discord: 'off',
        telegram: 'off',
        redis: 'off',
        api: 'off'
    };

    app.logger = logger.child({ module: 'index' });

    app.redis = process.env.REDISCLOUD_URL && new Redis(process.env.REDISCLOUD_URL);
    if (app.redis) {
        let redis_logger = logger.child({ module: 'redis' });

        app.redis.on('connect', () => {
            redis_logger.info('Redis is connected');
            app.health.redis = 'connect';
        })

        app.redis.on('ready', () => {
            redis_logger.info('Redis is ready');
            app.health.redis = 'ready';
        });

        app.redis.on('error', error => {
            redis_logger.error(`${error}`);
        });

        app.redis.on('reconnecting', time_to => {
            redis_logger.info(`Redis is reconnecting in ${time_to}`);
            app.health.redis = 'reconnecting';
        });

        app.redis.on('close', () => {
            redis_logger.info('Redis connection closed');
            app.health.redis = 'close';
        });

        app.redis.on('end', () => {
            redis_logger.info('Redis ends connection');
            app.health.redis = 'off';
        });
    }

    app.discord_client = new DiscordClient(app);

    app.telegram_client = new TelegramClient(app);

    app.api = new API(app);

    app.logger.info('Starting Discord Client');
    app.discord_client.start();

    app.logger.info('Starting Telegram Client');
    app.telegram_client.start();

    app.logger.info('Starting API');
    app.api.start();

    return app;
}

let app = main();

process.on('uncaughtException', (error) => {
    console.error('Got unhandledException:', error);
});

process.on('SIGINT', async () => {
    logger.child({ module: 'process-listener' }).info('Gracefully shutdowning application...');
    await app.discord_client.stop();
    await app.telegram_client.stop();
    await app.api.stop();
    process.exit();
});

process.on('SIGTERM', async () => {
    logger.child({ module: 'process-listener' }).info('Gracefully shutdowning application...');
    await app.discord_client.stop();
    await app.telegram_client.stop();
    await app.api.stop();
    process.exit();
});