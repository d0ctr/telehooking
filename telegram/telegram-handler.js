const GrammyTypes = require('grammy');
const mathjs = require('mathjs');
const axios = require('axios').default;
const { get_ahegao_url, get_urban_definition, get_conversion } = require('./utils');

const get_regex = /^[a-zA-Zа-яА-Я0-9_-]+$/g;
const url_start_regex = /^(https*:\/\/)*/;

class TelegramHandler { 
    constructor(client) {
        this.client = client;
        this.logger = client.logger.child({ module: 'telegram-handler' });
    }

    /**
     * Parse command line
     * @param {GrammyTypes.Context | Object} input
     * @param {Integer} limit number of parsable args
     * @return {Array<String>} [0] is always a command name
     */
    _parseArgs(input, limit) {
        let args = [];
        // split all words by <space>
        args = input.message.text.replace(/ +/g, ' ').split(' ');
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
     * @param {GrammyTypes.Context | Object} input
     * @returns {[String | null, String | null, String | null]} [err, response, short_response]
     */
    calc(input) {
        let math_line = this._parseArgs(input, 1)[1];
        if (!math_line) {
            return ['Напиши хоть что-нибудь, типа: 1+1'];
        }
        let result = null;
        try { 
            result = `${math_line} = ${mathjs.evaluate(math_line).toString()}`;
        }
        catch (err) {
            this.logger.error('Error while calculating:', err);
            return ['Что-то ты не то написал, этой командой можно считать только математические выражения'];
        }
        return [null, result, mathjs.evaluate(math_line).toString()];
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
/gh {ссылка} - конвертировать ссылку на GitHub в ссылку с Instant View
/curl {ссылка} - возвращает результат запроса к указанной ссылке в виде файла
`;
        return [null, message];
    }

    /**
     * `/discord_notification` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[null, String]}
     */
    discord_notification(input) {
        let message = `Отлично, можно начать работать
Теперь подпишись на канал в дискорде, указав id этого чата в команде: ${input.chat.id}`;
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
     * @param {GrammyTypes.Context | Object} input
     * @param {Object} interaction
     * @returns {[String | null, Object | null]}
     */
    async get(input, interaction) {
        let name = this._parseArgs(input, 1)[1];
        if (!name) {
            return ['Ты забыл указать название гета'];
        }
        if (!name.match(get_regex)) {
            return ['Название гета может состоять только из букв латинского, русского алфавитов и цифр'];
        }
        let result = null;
        try {
            result = await interaction.redisGet(name);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            return [`Что-то случилось во время получения гета:\n<code>${err}</code>`];
        }
        if (!result) {
            return [`Такого гета нет, можешь быть первым кто его сделает`];
        }
        return [null, result];
    }

    /**
     * `/set` command handler
     * @param {GrammyTypes.Context | Object} input 
     * @param {Object} interaction
     * @returns {[String | null, String | null]}
     */
    async set(input, interaction) {
        let name = this._parseArgs(input, 1)[1];
        if (!name) {
            return ['Ты забыл указать название гета'];
        }
        if (!name.match(get_regex)) {
            return ['Название гета может состоять только из букв латинского, русского алфавитов и цифр'];
        }
        if(!input.message.reply_to_message) {
            return ['Чтобы сохранить гет, ответьте на какое-нибудь сообщение с помощью <code>/set {название гета}</code>'];
        }

        let parsed_data = {};

        if (input.message.reply_to_message.animation) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.animation = input.message.reply_to_message.animation.file_id;
            parsed_data.type = 'animation';
        }
        else if (input.message.reply_to_message.audio) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.audio = input.message.reply_to_message.audio.file_id;
            parsed_data.type = 'audio';
        }
        else if (input.message.reply_to_message.document) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.document = input.message.reply_to_message.document.file_id;
            parsed_data.type = 'document';
        }
        else if (input.message.reply_to_message.video) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.video = input.message.reply_to_message.video.file_id;
            parsed_data.type = 'video';
        }
        else if (input.message.reply_to_message.video_note) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.video_note = input.message.reply_to_message.video_note.file_id;
            parsed_data.type = 'video_note';
        }
        else if (input.message.reply_to_message.voice) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.voice = input.message.reply_to_message.voice.file_id;
            parsed_data.type = 'voice';
        }
        else if (input.message.reply_to_message.sticker) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.sticker = input.message.reply_to_message.sticker.file_id;
            parsed_data.type = 'sticker';
        }
        else if (input.message.reply_to_message.photo) {
            if (input.message.reply_to_message.caption) {
                parsed_data.text = input.message.reply_to_message.caption;
            }
            parsed_data.photo = input.message.reply_to_message.photo[0].file_id;
            parsed_data.type = 'photo';
        }
        else if (input.message.reply_to_message.text) {
            parsed_data.text = input.message.reply_to_message.text;
            parsed_data.type = 'text';
        }
        else {
            return [`Такое сохранить не получится, сейчас поддерживаются только следующие форматы:
Простой текст, изображение, гифки, аудио, видео, документы, стикеры, голосовые и видео сообщения`];
        }
        
        try {
            await interaction.redisSet(name, parsed_data);
        }
        catch (err) {
            this.logger.error(`Error while saving content to redis: ${err.stack}`);
            return [`Что-то случилось во время сохранения гета:\n<code>${err}</code>`];
        }

        return [null, `Гет был сохранён, теперь его можно вызвать командой:\n<code>/get ${name}</code>${
            input.chat.id === input.from.id ? `\nТак же можешь вызвать этот гет написав <code>@BilderbergButler_bot {{/get ${name}}}</code> в поле ввода сообщения` : ''}`];
    }

    /**
     * `/get_list` command handler
     * @param {GrammyTypes.Context} _
     * @param {Object} interaction
     * @returns {[String | null, String | null]}
     */
    async get_list(_, interaction) {
        let gets = await interaction.redisGetList();
        if (!gets.length) {
            return [`В этом чате ещё нет ни однго гета`];
        }
        return [null, `Геты доступные в этом чате:\n\n${gets.join(', ')}`, `${gets.join(', ')}`];
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
            return [`Пока без ахегао, получил следующую ошибку:\n<code>${err}</code>`];
        }
        if (!ahegao_url) {
            return [`Вроде было, но не могу найти ни одно ахегао`];
        }
        if (ahegao_url.split('.').slice(-1) === 'gif') {
            return [null, { type: 'animation', animation: ahegao_url }];
        }
        return [null, { type: 'photo', photo: ahegao_url, url: ahegao_url }];
    }

    /**
     * `/urban` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[String | null, Object | null]}
     */
    async urban(input) {
        let word = this._parseArgs(input, 1)[1];
        let definition = null;
        try {
            definition = await get_urban_definition(word);
        }
        catch (err) {
            this.logger.error(`Error while getting definiton from Urban Dictionary: ${err.stack}`);
            return [`Турбулентность по пути в Urban Disctionary, попробуйте сами: <a href="https://www.urbandictionary.com/define.php?term=${word}">ссылка</a>`];
        }
        if (!definition) {
            return [`Не может быть, Urban Dictionary не знает что это за слово\nМожешь проверить сам: <a href="https://www.urbandictionary.com/define.php?term=${word}">ссылка</a>`];
        }
        return [null, { type: 'text', text: definition }];
    }

    /**
     * `/html` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[String | null, String | null]}
     */
    async html(input) {
        let text = this._parseArgs(input, 1)[1].trim();
        if (!text) {
            return [`Для того чтобы получить текст, нужно дать текст размеченный HTML`]
        }
        return [null, text, text];
    }

    /**
     * `/fizzbuzz` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[String | null, String | null]}
     */
    async fizzbuzz(input) {
        let args = this._parseArgs(input).slice(1);
        let dict = {};
        if (!args.length || args.length % 2 !== 0) {
            return ['Аргументы команды должны представлять из себя последовательность из комбинаций <code>число</code> <code>слово</code>'];
        }
        for (let i = 0; i < args.length; i += 2) {
            if (isNaN(Number(i))) {
                return [`<code>${i}</code> это не число, попробуй ещё раз`];
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
     * @param {GrammyTypes.Context | Object} input
     * @returns {[String | null, Object | null]}
     */
    async cur(input, interaction) {
        let args = this._parseArgs(input, 3).slice(1);
        if (!args.length) {
            return [`А где аргументы?\nПример использования <code>/cur 1 USD TRY</code>`];
        }
        let amount = Number(args[0]);
        if(isNaN(amount)) {
            return [`Неправильный первый аргумент, вместо <b>${amount}</b> должно быть число\nПример использования <code>/cur 1 USD TRY</code>`];
        }
        let from = interaction.getCurrency(args[1].toUpperCase());
        if (!from) {
            return [`Не могу найти валюту <b>${args[1]}</b>\nПример использования <code>/cur 1 USD TRY</code>\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`];
        }
        let to = interaction.getCurrency(args[2].toUpperCase());
        if (!to) {
            return [`Не могу найти валюту <b>${args[2]}</b>\nПример использования <code>/cur 1 USD TRY</code>\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`];
        }
        let result = null;
        try {
            result = await get_conversion(amount, from.id, to.id);
        }
        catch (err) {
            this.logger.error(`Error while converting currency: ${err.stack}`);
            return [`Что-то пошло не так\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`];
        }
        if(!result) {
            return [`Что-то пошло не так\nВот полная версия <a href="https://coinmarketcap.com/converter/">конвертора</a>`];
        }
        return [null, `${result[from.id]} ${from.name} = ${result[to.id].toFixed(2)} ${to.name}`, `${result[to.id].toFixed(2)}`];
    }

    /**
     * `/gh` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[null, Object | null, null, Object]} [null, answer, null, overrides]
     */
    async gh(input) {
        let arg = this._parseArgs(input, 1)[1];
        if (!arg) {
            return ['Не хватает ссылки на GitHub'];
        }
        if (!arg.includes('github')) {
            return ['Чтобы продолжить, нужна ссылка на GitHub.\nПоддерживаются ссылки на Markdown и reStructuredText, на главные странциы репозиториев, а так же на Pull Request и Issue'];
        }
        return [null, { type: 'text', text: `<a href="https://t.me/iv?url=${arg}&rhash=8643cab1135a25"> </a><a href="${arg}">${arg}</a>`}, null, { disable_web_page_preview: false }];
    }

    /**
     * `/curl` command handler
     * @param {GrammyTypes.Context | Object} input
     * @returns {[null, Object | null]} [null, answer]
     */
    async curl(input) {
        let arg = this._parseArgs(input, 1)[1];
        if (!arg) {
            return [`Не хватает URL`];
        }
        arg = arg.replace(url_start_regex, 'https://');
        let result;
        try {
            result = await axios.get(arg/**, { responseType: 'arraybuffer' } */);
        }
        catch (err) {
            this.logger.error(`Error while curling ${arg}: ${err.stack}`);
        }
        if (!result) {
            arg = arg.replace(url_start_regex, 'http://');
            try {
                result = await axios.get(arg);
            }
            catch (err) {
                this.logger.error(`Error while curling ${arg}: ${err.stack}`);
                return [`Что-то пошло не так\nНе могу получить данные по этой ссылке`];
            }
        }
        if (!result) {
            return [`Что-то пошло не так\nНе могу получить данные по этой ссылке`];
        }
        let filename = arg.split('/').slice(-1)[0] || 'response';
        let type = 'document';
        let caption = `<code>HTTP/${result.request.res.httpVersion} ${result.status} ${result.statusText}\n`;
        for (const [key, value] of Object.entries(result.headers)) {
            caption += `${key}: ${value}\n`;
        }
        caption += '</code>';
        if (caption.length >= 1024) {
            caption = `${caption.slice(0, 1014)}...</code>`;
        }
        if (result.headers['content-type'].includes('text/html')) {
            type = 'document';
            filename = `${filename}.html`;
            result = Buffer.from(result.data);
        }
        else if (result.headers['content-type'].includes('application/json')) {
            type = 'document';
            filename = `${filename}.json`;
            result = Buffer.from(JSON.stringify(result.data, null, 2));
        }
        else if (result.headers['content-type'].includes('text/plain')) {
            type = 'document';
            filename = `${filename}.txt`;
            result = Buffer.from(result.data);
        }
        else if (result.headers['content-type'].includes('image/png')
            || result.headers['content-type'].includes('image/jpeg')
            || result.headers['content-type'].includes('image/jpg')
            || result.headers['content-type'].includes('image/gif')) {
            type = 'photo';
            let extension = result.headers['content-type'].split('/')[1];
            if (!filename.endsWith(extension)){
                filename = `${filename}.${extension}`;
            }
            result = Buffer.from(result.data);
        }
        else {
            type = 'document';
            result = result.data;
        }
        return [null, { type: type, [type]: result, filename: filename, text: caption }];
    }
}

module.exports = TelegramHandler;
