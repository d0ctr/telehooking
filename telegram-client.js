const { Telegraf } = require('telegraf');
const TelegramHandler = require('./telegram-handler');

class TelegramInteraction {
    constructor(client, command_name) {
        this.client = client;
        this.logger = client.logger.child({module: 'telegram-interaction'});
        this.command_name = command_name;
        this._handler = client.handler;
    }

    get telegram() {
        return this.client.client.telegram;
    }

    get cooldown_key() {
        return `${this.notification_data.type[0] === '-' ? this.notification_data.type.slice(1) : this.notification_data.type}:${this.notification_data.user_id}:${this.chat_id}`;
    }

    async send_notification(notification_data, chat_id) {
        this.notification_data = notification_data;
        this.chat_id = chat_id;
        if (this.isCooldown()) return;

        let message = undefined;
        if (this.notification_data.type === 'foreveralone') {
            message = `Вы оставили ${this.notification_data.user_name} сидеть там совсем одного, может он и выйдет сам, а может быть и нет\n${this.notification_data.channel_url}`;
        }
        if (this.notification_data.type === 'new_stream') {
            message = `${this.notification_data.user_name} начал стрим в канале ${this.notification_data.channel_name}, приходите посмотреть\n${this.notification_data.channel_url}`;
        }
        if (this.notification_data.type === 'first_join') {
            message = `${this.notification_data.user_name} уже сидит один в канале ${this.notification_data.channel_name}, составьте ему компанию чтоль\n${this.notification_data.channel_url}`;
        }

        if (!message) return;
        this.logger.info(`Sending message [${message}]`);
        this.sent_message = await this.telegram.sendMessage(this.chat_id, message, {parse_mode: 'HTML'});
        this.cooldown();
    }

    cooldown() {
        this.client.cooldown_map[this.cooldown_key] = {
            timer: setTimeout(this._delete_cooldown.bind(this), this.client.cooldown_duration, this.cooldown_key),
            message_id: this.sent_message.message_id
        };
    }

    isCooldown() {
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

    respond(context) {
        this.logger.info(`Received command: ${context.message.text}`);
        try {
            this._handler[this.command_name](context);
        }
        catch (err) {
            this.logger.error(`Error while processing command: ${err}`);
            context.reply(`Что-то случилось:\n${err}`);
        }
    }
}

class TelegramClient {
    constructor(app) {
        this.app = app;
        this.logger = app.logger.child({module: 'telegram-client'});
        this.client = new Telegraf(process.env.TELEGRAM_TOKEN);
        this.handler = new TelegramHandler(this);
        this.cooldown_map = {};
        this.cooldown_duration = 5 * 1000;

        this.client.start(async (ctx) =>  new TelegramInteraction(this, 'start').respond(ctx));
        this.client.help(async (ctx) => new TelegramInteraction(this, 'help').respond(ctx));
        this.client.command('calc', async (ctx) => new TelegramInteraction(this, 'calc').respond(ctx));
        this.client.command('discord_notification', async (ctx) => new TelegramInteraction(this, 'discord_notification').respond(ctx));
    }

    start() {
        this.client.launch();
    }

    async send_notification(notification_data, chat_id) {
        if (!notification_data || !chat_id) return;
        new TelegramInteraction(this).send_notification(notification_data, chat_id);
    }
}

module.exports = TelegramClient;