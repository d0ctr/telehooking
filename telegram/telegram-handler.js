const TeleTypes = require('telegraf/types');
const TelegrafTypes = require('telegraf');
const mathjs = require('mathjs');
const { get_ahegao_url, get_urban_definition, get_conversion } = require('./utils');

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
        args = context.message.text.replace(/ +/g, ' ').split(' ');
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
     * `/start` command handler
     * @returns {[null, String]}
     */
    start() {
         let message = 'Этот бот что-то может, чтобы узнать что, воспользуйся командой /help';
         return [null, message];
    }

    /**
     * `/calc` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[String | null, String | null]} [err, response]
     */
    calc(context) {
        let math_line = this._parse_args(context, 1)[1];
        if (!math_line) {
            return ['Напиши хоть что-нибудь, типа: 1+1', null];
        }
        let result = null;
        try { 
            result = `${math_line} = ${mathjs.evaluate(math_line).toString()}`;
        }
        catch (err) {
            this.logger.error('Error while calculating:', err);
            return ['Что-то ты не то написал, этой командой можно считать только математические выражения', null];
        }
        return [null, result];
    }

    /**
     * `/help` command handler
     * @returns {[null, String | null]}
     */
    help() {
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
/html {текст} - конвертировать полученный текст в отформатированный HTML
/cur {число} {валюта1} {валюта2} - конвертировать число из валюты1 в валюта2
`;
        return [null, message];
    }

    /**
     * `/discord_notification` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[null, String]}
     */
    discord_notification(context) {
        let message = `Отлично, можно начать работать
Теперь подпишись на канал в дискорде, указав id этого чата в команде: ${context.chat.id}`;
        return [null, message];
    }

    /**
     * `/ping` command handler
     * @returns {[null, String]}
     */
    ping() {
        let message = '<code>pong</code>';
        return [null, message];
    }

    /**
     * `/get` command handler
     * @param {TelegrafTypes.Context} context
     * @param {Object} interaction
     * @returns {[String | null, Object | null]}
     */
    async get(context, interaction) {
        let name = this._parse_args(context, 1)[1];
        if (!name) {
            return ['Ты забыл указать название гета', null];
        }
        if (!name.match(get_regex)) {
            return ['Название гета может состоять только из букв латинского, русского алфавитов и цифр', null];
        }
        let result = null;
        try {
            result = await interaction.redis_get(name);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            return [`Что-то случилось во время получения гета:\n<code>${err}</code>`, null];
        }
        if (!result) {
            return [`Такого гета нет, можешь быть первым кто его сделает`, null];
        }
        return [null, result];
    }

    /**
     * `/set` command handler
     * @param {TelegrafTypes.Context} context 
     * @param {Object} interaction
     * @returns {[String | null, String | null]}
     */
    async set(context, interaction) {
        let name = this._parse_args(context, 1)[1];
        if (!name) {
            return ['Ты забыл указать название гета', null];
        }
        if (!name.match(get_regex)) {
            return ['Название гета может состоять только из букв латинского, русского алфавитов и цифр', null];
        }
        if(!context.message.reply_to_message) {
            return ['Чтобы сохранить гет, ответьте на какое-нибудь сообщение с помощью <code>/set {название гета}</code>', null];
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
            return [`Такое сохранить не получится, сейчас поддерживаются только следующие форматы:
Простой текст, изображение, гифки, аудио, видео, документы, стикеры, голосовые и видео сообщения`, null];
        }
        
        try {
            await interaction.redis_set(name, parsed_data);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            return [`Что-то случилось во время сохранения гета:\n<code>${err}</code>`, null];
        }
        return [null, `Гет был сохранён, теперь его можно вызвать командой:\n<code>/get ${name}</code>`];
    }

    /**
     * `/get_list` command handler
     * @param {TelegrafTypes.Context} _
     * @param {Object} interaction
     * @returns {[String | null, String | null]}
     */
    async get_list(_, interaction) {
        let gets = await interaction.redis_get_list();
        if (!gets.length) {
            return [`В этом чате ещё нет ни однго гета`, null];
        }
        return [null, `Геты доступные в этом чате:\n\n${gets.join(', ')}`];
    }

    /**
     * `/ahegao` command handler
     * @returns {[String | null, Object | null]}
     */
    async ahegao() {
        let ahegao_url = null;
        try {
            ahegao_url = await get_ahegao_url();
        }
        catch (err) {
            this.logger.error(`Error while getting ahegao url: ${err.stack}`);
            return [`Пока без ахегао, получил следующую ошибку:\n<code>${err}</code>`, null];
        }
        if (!ahegao_url) {
            return [`Вроде было, но не могу найти ни одно ахегао`, null];
        }
        if (ahegao_url.split('.').slice(-1) === 'gif') {
            return [null, { type: 'animation', animation: ahegao_url }];
        }
        return [null, { type: 'photo', photo: ahegao_url }];
    }

    /**
     * `/urban` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[String | null, String | null]}
     */
    async urban(context) {
        let word = this._parse_args(context, 1)[1];
        let definition = await get_urban_definition(word);
        if (!definition) {
            return [`Не может быть, Urban Dictionary не знает что это за слово\nМожешь проверить сам: <a href="https://www.urbandictionary.com/define.php?term=${word}">ссылка</a>`, null];
        }
        return [null, definition];
    }

    /**
     * `/html` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[String | null, String | null]}
     */
    async html(context) {
        let text = this._parse_args(context, 1)[1].trim();
        if (!text) {
            return [`Для того чтобы получить текст, нужно дать текст размеченный HTML`, null]
        }
        return [null, text];
    }

    /**
     * `/fizzbuzz` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[String | null, String | null]}
     */
    async fizzbuzz(context) {
        let args = this._parse_args(context).slice(1);
        let dict = {};
        if (!args.length || args.length % 2 !== 0) {
            return ['Аргументы команды должны представлять из себя последовательность из комбинаций <code>число</code> <code>слово</code>', null];
        }
        for (let i = 0; i < args.length; i += 2) {
            if (isNaN(Number(i))) {
                return [`<code>${i}</code> это не число, попробуй ещё раз`, null];
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
        return [null, answer];
    }

    /**
     * `/cur` command handler
     * @param {TelegrafTypes.Context} context
     * @returns {[String | null, Object | null]}
     */
    async cur(context, interaction) {
        let args = this._parse_args(context, 3).slice(1);
        if (!args.length) {
            return [`А где аргументы?\nПример использования <code>/cur 1 USD TRY</code>`, null];
        }
        let amount = Number(args[0]);
        if(isNaN(amount)) {
            return [`Неправильный первый аргумент, вместо <b>${amount}</b> должно быть число\nПример использования <code>/cur 1 USD TRY</code>`, null];
        }
        let from = interaction.get_currency(args[1].toUpperCase());
        if (!from) {
            return [`Не могу найти валюту <b>${args[1]}</b>\nПример использования <code>/cur 1 USD TRY</code>\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`, null];
        }
        let to = interaction.get_currency(args[2].toUpperCase());
        if (!to) {
            return [`Не могу найти валюту <b>${args[2]}</b>\nПример использования <code>/cur 1 USD TRY</code>\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`, null];
        }
        let result = null;
        try {
            result = await get_conversion(amount, from.id, to.id);
        }
        catch (err) {
            this.logger.error(`Error while converting currency: ${err.stack}`);
            return [`Что-то пошло не так\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`, null];
        }
        if(!result) {
            return [`Что-то пошло не так\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`, null];
        }
        return [null, `${result[from.id]} ${from.name} = ${result[to.id].toFixed(2)} ${to.name}`];
    }
 }

module.exports = TelegramHandler;
