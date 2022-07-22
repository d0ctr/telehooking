const dotenv = require('dotenv');
const Redis = require('ioredis');
const DiscordClient = require('./discord');
const TelegramClient = require('./telegram');
const { createLogger, format, transports } = require('winston');

dotenv.config();

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.printf(options => {
            return `${options.timestamp} - ${options.module} - ${options.level} - ${options.message.replace(/\n/gm, '\\n')}`;
        })
    ),
    transports: [new transports.Console()]
});

function main() {
    let app = {};
    app.logger = logger.child({module: 'index'});
    app.redis = new Redis(process.env.REDISCLOUD_URL);
    app.discord_client = new DiscordClient(app);
    app.telegram_client = new TelegramClient(app);
    app.logger.info('Starting Discord Client');
    app.discord_client.start();
    app.logger.info('Starting Telegram Client');
    app.telegram_client.start();
}

main();

process.on('uncaughtException', (error) => {
    console.error('Got unhandledException:', error);
})