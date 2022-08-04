const { Telegraf, Context, Telegram } = require('telegraf');
const TelegramHandler = require('./telegram-handler');
const config = require('../config.json');
const { get_currencies_list } = require('./utils');

/**
 * One time use interaction between app and telegram
 * @property {TelegramClient} this.client
 * @property {String?} this.command_name
 * @property {Context?} this.context
 */
class TelegramInteraction {
    /**
     * One time use interaction between app and telegram
     * @param {TelegramClient} client 
     * @param {String} [command_name] 
     * @param {Context} [context]
     */
    constructor(client, command_name, context) {
        this.client = client;
        this.logger = client.logger.child({module: 'telegram-interaction'});
        this.command_name = command_name;
        this.context = context;
        this.handler = client.handler;
        this._redis = client.redis;
        this._currencies_list = client.currencies_list
    }

    /**
     * @returns {Telegram}
     */
    get telegram() {
        return this.client.client.telegram;
    }

    get cooldown_key() {
        return `${this.notification_data.type[0] === '-' ? this.notification_data.type.slice(1) : this.notification_data.type}:${this.notification_data.user_id}:${this.chat_id}`;
    }

    async send_notification(notification_data, chat_id) {
        this.notification_data = notification_data;
        this.chat_id = chat_id;
        if (this._isCooldown()) return;

        let message = undefined;
        if (this.notification_data.type === 'foreveralone') {
            message = `Вы оставили ${this.notification_data.user_name} сидеть <a href="${this.notification_data.channel_url}">там</a> совсем одного, может он и выйдет сам, а может быть и нет`;
        }
        if (this.notification_data.type === 'new_stream') {
            message = `${this.notification_data.user_name} начал стрим в канале <a href="${this.notification_data.channel_url}">${this.notification_data.channel_name}</a>, приходите посмотреть`;
        }
        if (this.notification_data.type === 'first_join') {
            message = `${this.notification_data.user_name} уже сидит один в канале <a href="${this.notification_data.channel_url}">${this.notification_data.channel_name}</a>, составьте ему компанию чтоль`;
        }

        if (!message) return;
        this.logger.info(`Sending message [${message}]`);
        this.sent_message = await this.telegram.sendMessage(this.chat_id, message, { parse_mode: 'HTML', disable_web_page_preview: true });
        this._cooldown();
    }

    _cooldown() {
        this.client.cooldown_map[this.cooldown_key] = {
            timer: setTimeout(this._delete_cooldown.bind(this), this.client.cooldown_duration, this.cooldown_key),
            message_id: this.sent_message.message_id
        };
    }

    _isCooldown() {
        if (this.client.cooldown_map[this.cooldown_key]) {
            if (this.notification_data.type[0] === '-') {
                if (this.client.cooldown_map[this.cooldown_key].message_id) {
                    let message_id = this.client.cooldown_map[this.cooldown_key].message_id;
                    this.client.client.telegram.deleteMessage(this.chat_id, message_id);
                    delete this.client.cooldown_map[this.cooldown_key].message_id;

                    if (!Object.keys(this.client.cooldown_map[this.cooldown_key]).length) {
                        delete this.client.cooldown_map[this.cooldown_key];
                        return false;
                    }
                }
            }
            if (this.client.cooldown_map[this.cooldown_key].timer) {
                return true;
            }
        }
        return false;
    }

    _delete_cooldown(key) {
        delete this.client.cooldown_map[key].timer;
        if (!Object.keys(this.client.cooldown_map[key]).length) {
            delete this.client.cooldown_map[key];
        }
    }

    async respond() {
        try {
            if (typeof this.handler[this.command_name] === 'function') {
                this.logger.info(`Received command: ${this.context.message.text}`);
                const [err, response] = await this.handler[this.command_name](this.context, this);
                if (err) {
                    return await this._reply(err);
                }
                if (response instanceof String || typeof response === 'string') {
                    return await this._reply(response);
                }
                if (response instanceof Object) {
                    return await this._replyWithMedia(response);
                }
            }
            else {
                this.logger.info(`Received nonsense, how did it get here???: ${this.context.message.text}`);
            }
        }
        catch (err) {
            this.logger.error(`Error while processing command [${this.context.message.text}]: ${err.stack}`);
            this._reply(`Что-то случилось:\n<code>${err}</code>`);
        }
    }

    async redis_get(name) {
        if (!this._redis) {
            throw new Error('Storage is offline');
        }
        let key = `${this.context.chat.id}:get:${name}`;
        return await this._redis.hgetall(key);
    }

    async redis_set(name, data) {
        if (!this._redis) {
            throw new Error('Storage is offline');
        }
        let key = `${this.context.chat.id}:get:${name}`;
        for (let i in data) {
            if (!data[i]) {
                delete data[i];
            }
        }
        if (!Object.keys(data).length) {
            new Error('Cannot save empty data');
        }
        await this._redis.hmset(key, data);
    }

    async redis_get_list() {
        if (!this._redis) {
            throw new Error('Storage is offline');
        }
        let key = `${this.context.chat.id}:get:*`;
        let r_keys = await this._redis.keys(key);
        let keys = [];
        for (let r_key of r_keys) {
            keys.push(r_key.split(':').slice(-1));
        }
        return keys;
    }

    get_currency(name) {
        return this._currencies_list ? this._currencies_list[name] : null;
    }

    /**
     * Reply to message
     * @param {String} text text to send
     * @return {Message | null}
     */
    async _reply(text) {
        this.logger.info(`Replying with [${text}]`);
        try {
            return await this.context.replyWithHTML(text, {
                reply_to_message_id: this.context.message.message_id,
                disable_web_page_preview: true,
                allow_sending_without_reply: true
            });
        } catch (reason) {
            this.logger.error(`Could not send message, got an error: ${reason}`);
            return this._reply(`Не смог отправить ответ, давай больше так не делать`);
        }
    }

    /**
     * Reply to message with media
     * @param {Object} message may contain text and an id of one of `[animation, audio, document, video, video_note, voice, sticker]`
     * @return {Message | null}
     */
    async _replyWithMedia(message) {
        if (message.text && message.type === 'text') {
            return this._reply(message.text);
        }
        let message_options = {
            reply_to_message_id: this.context.message.message_id,
            caption: message.text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            allow_sending_without_reply: true
        };

        let media = message[message.type];

        let media_type = message.type.split('');
        media_type[0] = media_type[0].toUpperCase();
        media_type = media_type.join('');

        if (typeof this.context['replyWith' + media_type] === 'function') {
            this.logger.info(`Replying with [${message_options.caption ? `${message_options.caption} ` : ''}${media_type}:${media}]`);
            return await this.context['replyWith' + media_type](media, message_options);
        }
        this.logger.info(`Can't send what is left of the message ${JSON.stringify(message)}`);
        return (message_options.text || null) && this._reply(message_options.caption);
    }
}

class TelegramClient {
    /**
     * TelegramClient
     * @param {Object} app containing logger and redis
     */
    constructor(app) {
        this.app = app;
        this.redis = app.redis ? app.redis : null;
        this.logger = app.logger.child({ module: 'telegram-client' });
        this.client = new Telegraf(process.env.TELEGRAM_TOKEN);
        this.handler = new TelegramHandler(this);
        this.cooldown_map = {};
        this.cooldown_duration = 5 * 1000;

        this.client.start(async (ctx) => new TelegramInteraction(this, 'start', ctx).respond());
        this.client.help(async (ctx) => new TelegramInteraction(this, 'help', ctx).respond());
        this.client.command('calc', async (ctx) => new TelegramInteraction(this, 'calc', ctx).respond());
        this.client.command('discord_notification', async (ctx) => new TelegramInteraction(this, 'discord_notification', ctx).respond());
        this.client.command('ping', async (ctx) => new TelegramInteraction(this, 'ping', ctx).respond());

        if (app) {
            this.client.command('set', async (ctx) => new TelegramInteraction(this, 'set', ctx).respond());
            this.client.command('get', async (ctx) => new TelegramInteraction(this, 'get', ctx).respond());
            this.client.command('get_list', async (ctx) => new TelegramInteraction(this, 'get_list', ctx).respond());
        }

        if (config.URBAN_API) {
            this.client.command('urban', async (ctx) => new TelegramInteraction(this, 'urban', ctx).respond());
        }

        if (config.AHEGAO_API) {
            this.client.command('ahegao', async (ctx) => new TelegramInteraction(this, 'ahegao', ctx).respond());
        }

        this.client.command('html', async (ctx) => new TelegramInteraction(this, 'html', ctx).respond());
        this.client.command('fizzbuzz', async (ctx) => new TelegramInteraction(this, 'fizzbuzz', ctx).respond());

        if (process.env.COINMARKETCAP_TOKEN && config.COINMARKETCAP_API) {
            this.client.command('cur', async (ctx) => new TelegramInteraction(this, 'cur', ctx).respond());
            get_currencies_list().then(result => {
                this.currencies_list = result;
            }).catch(reason => {
                if (reason) {
                    this.logger.error(`Error while retrieving currencies list: ${reason}`);
                }
            });
        }
    }

    set health(value) {
        this.app.health.telegram = value;
    }

    get health() {
        return this.app.health.telegram;
    }

    async start() {
        if (!process.env.TELEGRAM_TOKEN) {
            this.logger.warn(`Token for Telegram wasn't specified, client is not started.`);
            return;
        }

        if (process.env.ENV === 'dev' || !process.env.PORT) {
            this._start_polling();
        }
        else {
            this.client.telegram.setWebhook(`${config.DOMAIN}/telegram-${Date.now()}/${this.client.secretPathComponent()}`).then(() => {
                this.logger.info('Telegram webhook is set.');
                this.health = 'set';
                this.app.api.express.use(this.client.webhookCallback(`/telegram/${this.client.secretPathComponent()}`));
            }).catch(reason => {
                this.logger.error(`Error while setting telegram webhook: ${reason.stack}`);
                this.logger.info('Trying to start with polling');
                this._start_polling();
            });
        }
    }

    stop() {
        if (!process.env.TELEGRAM_TOKEN) {
            return;
        }
        this.logger.info('Gracefully shutdowning Telegram client.');
        this.client.telegram.setWebhook();
        this.client.stop('Gracefull Shutdown');
    }

    _start_polling() {
        if (!process.env.TELEGRAM_TOKEN) {
            this.logger.warn(`Token for Telegram wasn't specified, client is not started.`);
            return;
        }
        this.client.launch().then(() => {
            this.health = 'ready';
        }).catch(reason => {
            this.logger.error(`Error while starting Telegram client: ${reason}`);
            this.health = 'off';
        });
    }

    async send_notification(notification_data, chat_id) {
        if (!notification_data || !chat_id || !this.client) return;
        for (let diff of notification_data['+']) {
            new TelegramInteraction(this).send_notification({ ...diff, ...notification_data.channel }, chat_id);
        }
        for (let diff of notification_data['-']) {
            new TelegramInteraction(this).send_notification({ ...diff, ...notification_data.channel }, chat_id);
        }
    }
}

module.exports = TelegramClient;