const { createLogger, format, transports } = require('winston');
const LokiTransport = require('winston-loki');

require('dotenv').config();

const ENABLE_LOKI = process.env.ENABLE_LOKI === 'true';

const logger_options = {
    transports: [
        new transports.Console({
            format: format.combine(
                format.timestamp(),
                format.colorize(),
                format.printf(options => {
                    return `${options.timestamp} - ${options.module} - ${options.level} - ${options.level === 'error' ? options.message : options.message.replace(/\n/gm, '\\n').replace(/ +/gm, ' ')}`;
                })
            ),
            level: 'debug',
        }),
    ]
};

if (ENABLE_LOKI) {
    const { 
        LOKI_HOST: LOKI_HOST,
        LOKI_LABELS: LOKI_LABELS,
        RAILWAY_GIT_COMMIT_MESSAGE: LAST_COMMIT,
        LOKI_USER: LOKI_USER,
        LOKI_PASS: LOKI_PASS
    } = process.env;

    const VERSION = require('./package.json').version;

    logger_options.transports.push(
        new LokiTransport({
            host: LOKI_HOST,
            json: true,
            labels: {
                ...JSON.parse(LOKI_LABELS),
                version: VERSION,
                last_commit: LAST_COMMIT,
            },
            basicAuth: `${LOKI_USER}:${LOKI_PASS}`,
            format: format.json(),
            level: 'debug',
        })
    )
}

const logger = createLogger(logger_options);

module.exports = logger;
