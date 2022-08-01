const express = require('express');

const config = require('../config.json')

class API {
    constructor (app) {
        this.app = app;
        this.logger = app.logger.child({ module: 'api' });

        this.api = express();

        this.api.use((req, res, next) => {
            this.logger.info(`Received [${req.method} : ${req.url}]${Object.keys(req.params).length ? ` [${JSON.stringify(req.params)}]` : ''}`);
            next();
        });

        this.api.get('/', (req, res) => {
            res.redirect(config.API_HOMEPAGE);
        });

        this.api.get('/health', (req, res) => {
            res.json(this.app.health);
        })

        this.api.get('/health/:name', (req, res) => {
            if (req.params.name && Object.keys(this.app.health).includes(req.params.name)) {
                res.json({
                    [req.params.name]: this.app.health[req.params.name]
                });
                return;
            }
            res.json(this.app.health);
        });
    }

    set health(value) {
        this.app.health.api = value;
    }

    get health() {
        return this.app.health.api;
    }

    start() {
        if (!process.env.PORT) {
            this.logger.warn(`Port for API wasn't specified, API is not started.`);
            return;
        }
        this.api.listen(process.env.PORT, () => {
            this.logger.info('API is ready');
            this.health = 'ready';
        })
    }
}

module.exports = API;