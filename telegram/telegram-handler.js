const TeleTypes = require('telegraf/types');
const TelegrafTypes = require('telegraf');
const mathjs = require('mathjs');
const { get_ahegao_url, get_urban_definition } = require('./utils');

const get_regex = /^[a-zA-Zа-яА-Я0-9_-]+$/g;

class TelegramHandler { 
    constructor(client) {
        this.client = client;
        this.logger = client.logger.child({ module: 'telegram-handler' });
    }

    /**
     * Parse command line
     * @param {TelegrafTypes.Context} context
     * @param {Integer} limit number of parsable args
     * @return {Array<String>} [0] is always a command name
     */
    _parse_args(context, limit) {
        let args = [];
        // split all words by <space>
        args = context.message.text.replace(/ +/g, ' ').split(' ').trim();
        // remove `/` from the name of the command
        args[0] = args[0].split('').slice(1).join('');
        // concat args to single arg 
        if (limit && (limit + 1) < args.length && limit > 0) {
            args[limit] = args.slice(limit).join(' ');
            args = args.slice(0, limit + 1);
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
        context.replyWithHTML(text, { reply_to_message_id: context.message.message_id, disable_web_page_preview: true, allow_sending_without_reply: true }).catch(reason => {
            this.logger.error(`Could not send message, got an error: ${reason}`);
            this._reply(context, `Не смог отправить ответ, давай больше так не делать`);
        });
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
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            allow_sending_without_reply: true
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
        message_options.text && this._reply(context, message_options.text);
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
/ahegao - получить случайное ахегао
/urban {слово?} - получить значение указанного или случайного слова из <a href="https://www.urbandictionary.com/">Urban Dictionary</>
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

    /**
     * `/ahegao` command handler
     * @param {TelegrafTypes.Context} context
     */
    async ahegao(context) {
        let ahegao_url = null;
        try {
            ahegao_url = await get_ahegao_url();
        }
        catch (err) {
            this.logger.error(`Error while getting ahegao url: ${err.stack}`);
            this.reply_(context, `Пока без ахегао, получил следующую ошибку:\n<code>${err}</code>`);
            return;
        }
        if (!ahegao_url) {
            this._reply(context, `Вроде было, но не могу найти ни одно ахегао`);
            return;
        }
        if (ahegao_url.split('.').slice(-1) === 'gif') {
            this._replyWithMedia(context, { type: 'animation', animation: ahegao_url });
            return;
        }
        this._replyWithMedia(context, { type: 'photo', photo: ahegao_url });
    }

    /**
     * `/urban` command handler
     * @param {TelegrafTypes.Context} context
     */
    async urban(context) {
        let word = this._parse_args(context, 1)[1];
        let definition = await get_urban_definition(word);
        if (!definition) {
            this._reply(context, `Не может быть, Urban Dictionary не знает что это за слово\nМожешь проверить сам: <a href="https://www.urbandictionary.com/define.php?term=${word}">ссылка</a>`);
            return;
        }
        this._reply(context, definition);
    }

    /**
     * `/html` command handler
     * @param {TelegrafTypes.Context} context
     */
    async html(context) {
        let text = this._parse_args(context, 1)[1].trim();
        this.reply(context, text);
    }

    /**
     * `/fizzbuzz` command handler
     * @param {TelegrafTypes.Context} context
     */
    async fizzbuzz(context) {
        let args = this._parse_args(context).slice(1);
        let dict = {};
        if (!args.length || args.length % 2 !== 0) {
            this._reply(context, 'Аргументы команды должны представлять из себя последовательность из комбинаций <code>число</code> <code>слово</code>');
            return;
        }
        for (let i = 0; i < args.length; i += 2) {
            if (isNan(Number(i))) {
                this._reply(context, `<code>${i}</code> это не число, попробуй ещё раз`);
                return;
            }
            dict[args[i]] = args[i + 1];
        }
        let answer = '';
        for (let i = 1; i < 101; i++) {
            let result = '';
            for (let key in dict) {
                if (i % Number(key) === 0) {
                    result += dict[key];
                }
            }
            if (result === '') {
                result = i;
            }
            answer += `${result}\n`
        }
        answer = answer.trim();
        this._reply(context, answer);
    }
 }

module.exports = TelegramHandler;
