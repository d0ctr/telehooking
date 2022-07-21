const mathjs = require('mathjs');

class TelegramHandler { 
    constructor(client) {
        this.client = client;
        this.logger = client.logger.child('telegram-handler');
    }

    _reply(context, text) {
        this.logger.info(`Replying with [${text}]`);
        context.reply(text, {reply_to_message_id: context.message.message_id});
    }

    start(context) {
         let message = 'Этот бот что-то может, чтобы узнать что, воспользуйся командой /help';
         this._reply(context, message);
    }

    calc(context) {
        let math_line = context.message.text.replace(/\/calc/gm, '').trim();
        if (!math_line) {
            this._reply(context, 'Напиши хоть что-нибудь, типа: 1+1')
            return;
        }
        let result = null;
        try { 
            result = mathjs.evaluate(math_line).toString();
        }
        catch (err) {
            this.logger.error('Error while calculating:', err)
        }
        if (!result) {
            this._reply(context, 'Что-то ты не то написал, этой командой можно считать только математические выражения');
            return;
        }
        this._reply(context, result);
    }

    help (context) {
        let message = `Вот список доступных команд:
/help - список команд
/discord_notification - получение id чата для получения уведомлений из дискорда
/calc {математическое выражение} - возвращает результат математического выражения
`;
        this._reply(context, message);
    }

    discord_notification(context) {
        let message = `Отлично, можно начать работать
Теперь подпишись на канал в дискорде, указав id этого чата в команде: ${context.chat.id}`;
        this._reply(context, message);
    }
}

module.exports = TelegramHandler;