const { Telegraf } = require('telegraf');

class TelegramClient {
    constructor(app) {
        this.app = app;
        this.logger = app.logger.child({module: 'telegram-client'});
        this.client = new Telegraf(process.env.TELEGRAM_TOKEN);
        this.client.start((ctx) => {
            let message = `Отлично, можно начать работать
Теперь подпишись на канал в дискорде, указав id этого чата в команде: __\\${ctx.chat.id}__`;
            this.logger.info(`Sending message [${message}]`);
            ctx.reply(message, {parse_mode: 'MarkdownV2' });
        });
    }

    start() {
        this.client.launch();
    }

    async sendNotification(notification_data, chat_id) {
        let message = undefined;
        if (notification_data.alone) {
            message = `Вы оставили ${notification_data.alone.user_name} сидеть там совсем одного, может он и выйдет сам, а может быть и нет\n${notification_data.channel_info.channel_url}`;
        }
        if (notification_data.new_stream) {
            message = `${notification_data.new_stream.user_name} начал стрим в канале ${notification_data.channel_info.channel_name}, приходите посмотреть\n${notification_data.channel_info.channel_url}`;
        }
        if (notification_data.first_join) {
            message = `${notification_data.first_join.user_name} уже сидит один в канале ${notification_data.channel_info.channel_name}, составьте ему компанию чтоль\n${notification_data.channel_info.channel_url}`;
        }

        if (!message) return;
        this.logger.info(`Sending message [${message}]`);
        await this.client.telegram.sendMessage(chat_id, message, {parse_mode: 'HTML'});
    }
}

module.exports = TelegramClient;