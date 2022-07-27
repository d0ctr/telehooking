const TeleTypes = require('telegraf/types');
const TelegrafTypes = require('telegraf');
const mathjs = require('mathjs');
const get_regex = /^[a-zA-Zа-яА-Я0-9_-]+$/g;

class TelegramHandler { 
    constructor(client) {
        this.client = client;
        this.logger = client.logger.child('telegram-handler');
    }

    /**
     * Parse command line
     * @param {TelegrafTypes.Context} context
     * @param {Integer} limit number of parsable args
     * @return {Array<String>} [0] is always a command name
     */
    _parse_args(context, limit) {
        limit += 1;
        let args = [];
        args = context.message.text.replace(/ +/g, ' ').replace(/\/calc/gm, '').split(' ');
        if (limit && limit < args.length && limit > 1) {
            args[limit - 1] = args.slice(limit - 1).join(' ');
        }
        return args;
    }

    /**
     * Reply to message
     * @param {TelegrafTypes.Context} context command context
     * @param {String} text text to send
     */
    _reply(context, text) {
        this.logger.info(`Replying with [${text}]`);
        context.replyWithHTML(text, {reply_to_message_id: context.message.message_id});
    }

    /**
     * Reply to message with media
     * @param {TelegrafTypes.Context} context 
     * @param {Object} message may contain text and an id of one of `[animation, audio, document, video, video_note, voice, sticker]`
     */
    _replyWithMedia(context, message) {
        if (message.text && message.type === 'text') {
            this._reply(context, message.text);
            return;
        }
        let message_options = {
            reply_to_message_id: context.message.message_id,
            caption: message.text,
            parse_mode: 'HTML'
        };

        let media = message[message.type];

        let media_type = message.type.split('');
        media_type[0] = media_type[0].toUpperCase();
        media_type = media_type.join('');

        if (typeof context['replyWith' + media_type] === 'function') {
            this.logger.info(`Replying with [${message_options.caption ? `${message_options.caption} ` : ''}${media_type}:${media}]`);
            context['replyWith' + media_type](media, message_options);
            return;
        }
        this.logger.info(`Can't send what is left of the message ${JSON.stringify(message)}`);
        message_options.caption && this._reply(context, message_options.caption);
    }
    /**
     * `/start` command handler
     * @param {TelegrafTypes.Context} context 
     */
    start(context) {
         let message = 'Этот бот что-то может, чтобы узнать что, воспользуйся командой /help';
         this._reply(context, message);
    }

    /**
     * `/calc` command handler
     * @param {TelegrafTypes.Context} context 
     */
    calc(context) {
        let math_line = this._parse_args(context, 1)[1];
        if (!math_line) {
            this._reply(context, 'Напиши хоть что-нибудь, типа: 1+1')
            return;
        }
        let result = null;
        try { 
            result = math_line + ' = ' + mathjs.evaluate(math_line).toString();
        }
        catch (err) {
            this.logger.error('Error while calculating:', err);
            this._reply(context, 'Что-то ты не то написал, этой командой можно считать только математические выражения');
            return;
        }
        this._reply(context, result);
    }

    /**
     * `/help` command handler
     * @param {TelegrafTypes.Context} context 
     */
    help (context) {
        let message = `Вот список доступных команд:
/help - список команд
/discord_notification - получение id чата для получения уведомлений из дискорда
/calc {математическое выражение} - возвращает результат математического выражения
/ping - pong
/set {название} - сохранить контент сообщения на которое было отвечено командой
/get {название} - вызвать контент, сохранённый командой <code>/set</code>
/get_list - показать список гетов, доступных в этом чате
`;
        this._reply(context, message);
    }

    /**
     * `/discord_notification` command handler
     * @param {TelegrafTypes.Context} context 
     */
    discord_notification(context) {
        let message = `Отлично, можно начать работать
Теперь подпишись на канал в дискорде, указав id этого чата в команде: ${context.chat.id}`;
        this._reply(context, message);
    }

    /**
     * `/ping` command handler
     * @param {TelegrafTypes.Context} context 
     */
    ping(context) {
        let message = '<code>pong</code>';
        this._reply(context, message);
    }

    /**
     * `/get` command handler
     * @param {TelegrafTypes.Context} context 
     */
    async get(context, interaction) {
        let name = this._parse_args(context, 1)[1];
        if (!name) {
            this._reply(context, 'Ты забыл указать название гета');
            return;
        }
        if (!name.match(get_regex)) {
            this._reply(context, 'Название гета может состоять только из букв латинского, русского алфавитов и цифр');
            return;
        }
        let result = null;
        try {
            result = await interaction.redis_get(name);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            this._reply(context, `Что-то случилось во время получения гета:\n<code>${err}</code>`);
            return;
        }
        if (!result) {
            this._reply(context, `Такого гета нет, можешь первым его сделать`);
            return;
        }
        this._replyWithMedia(context, result);
    }

    /**
     * `/set` command handler
     * @param {TelegrafTypes.Context} context 
     */
    async set(context, interaction) {
        let name = this._parse_args(context, 1)[1];
        if (!name) {
            this._reply(context, 'Ты забыл указать название гета');
            return;
        }
        if (!name.match(get_regex)) {
            this._reply(context, 'Название гета может состоять только из букв латинского, русского алфавитов и цифр');
            return;
        }
        if(!context.message.reply_to_message) {
            this._reply(context, 'Чтобы сохранить гет, ответьте на какое-нибудь сообщение с помощью <code>/set {название гета}</code>');
            return;
        }

        let parsed_data = {};

        if (context.message.reply_to_message.animation) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.animation = context.message.reply_to_message.animation.file_id;
            parsed_data.type = 'animation';
        }
        else if (context.message.reply_to_message.audio) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.audio = context.message.reply_to_message.audio.file_id;
            parsed_data.type = 'audio';
        }
        else if (context.message.reply_to_message.document) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.document = context.message.reply_to_message.document.file_id;
            parsed_data.type = 'document';
        }
        else if (context.message.reply_to_message.video) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.video = context.message.reply_to_message.video.file_id;
            parsed_data.type = 'video';
        }
        else if (context.message.reply_to_message.video_note) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.video_note = context.message.reply_to_message.video_note.file_id;
            parsed_data.type = 'video_note';
        }
        else if (context.message.reply_to_message.voice) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.voice = context.message.reply_to_message.voice.file_id;
            parsed_data.type = 'voice';
        }
        else if (context.message.reply_to_message.sticker) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.sticker = context.message.reply_to_message.sticker.file_id;
            parsed_data.type = 'sticker';
        }
        else if (context.message.reply_to_message.photo) {
            if (context.message.reply_to_message.caption) {
                parsed_data.text = context.message.reply_to_message.caption;
            }
            parsed_data.photo = context.message.reply_to_message.photo[0].file_id;
            parsed_data.type = 'photo';
        }
        else if (context.message.reply_to_message.text) {
            parsed_data.text = context.message.reply_to_message.text;
            parsed_data.type = 'text';
        }
        else {
            this._reply(context, `Такое сохранить не получится, сейчас поддерживаются только следующие форматы:
Простой текст, изображение, гифки, аудио, видео, документы, стикеры, голосовые и видео сообщения`);
            return;
        }
        
        try {
            await interaction.redis_set(name, parsed_data);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            this._reply(context, `Что-то случилось во время сохранения гета:\n<code>${err}</code>`);
            return;
        }
        this._reply(context, `Гет был сохранён, теперь его можно вызвать командой:\n<code>/get ${name}</code>`);
    }

    /**
     * `/get_list` command handler
     * @param {TelegrafTypes.Context} context 
     */
    async get_list(context, interaction) {
        let gets = await interaction.redis_get_list();
        if (!gets.length) {
            this._reply(context, `В этом чате ещё нет ни однго гета`);
            return;
        }
        this._reply(context, `Геты доступные в этом чате:\n\n${gets.join(', ')}`);
    }
}

module.exports = TelegramHandler;