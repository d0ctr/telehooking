require('dotenv').config();

const express = require('express');

const { handleWebhook } = require('./webhook-handler');

class APIServer {
    constructor (app) {
        this.app = app;
        this.logger = require('../logger').child({ module: 'api-server' });

        this.express = express();

        this.express.use((req, res, next) => {
            this.logger.info(
                `Received [${req.method} : ${req.originalUrl}]`,
                { method: req.method, uri: req.originalUrl, body: req.body }
            );
            next();
        });

        if (process.env.TELEGRAM_TOKEN) {
            this.setWebhookMiddleware('/webhook/:app/:telegram_chat_id', handleWebhook);
        }
    }

    async start() {
        if (!process.env.PORT) {
            this.logger.warn(`Port for API wasn't specified, API is not started.`);
            return;
        }
        this._server = this.express.listen(process.env.PORT, () => {
            this.logger.info('API is ready');
        })
    }

    async stop() {
        if (!process.env.PORT) {
            return;
        }
        this.logger.info('Gracefully shutdowning API');
        this._server.close(err => {
            if (err) {
                this.logger.error(`Error while shutdowning API: ${err.stack || err}`, { error: err.stack || err });
            }
            this.health = 'off';
        });
    }

    setWebhookMiddleware(uri, middleware) {
        this.express.use(uri, express.json());
        this.express.use(uri, middleware);
    }
}

module.exports = APIServer;