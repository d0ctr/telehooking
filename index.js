require('dotenv-vault-core').config();
if (process.env.ENV !== 'prod') {
    require('dotenv').config();
}

const APIServer = require('./api');

const logger = require('./logger');

function main() {
    let app = {};

    app.logger = require('./logger').child({ module: 'index' });

    app.api_server = new APIServer(app);

    app.logger.info('Starting API...');
    app.api_server.start();

    return app;
}

let app = main();

process.on('uncaughtException', (error) => {
    console.error('Got unhandledException:', error);
});

process.on('SIGINT', async () => {
    logger.child({ module: 'process-listener' }).info('Gracefully shutdowning application...');
    await app.api_server.stop();
    process.exit();
});

process.on('SIGTERM', async () => {
    logger.child({ module: 'process-listener' }).info('Gracefully shutdowning application...');
    await app.api_server.stop();
    process.exit();
});