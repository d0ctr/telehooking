/**
 * `/help` command handler
 * @returns {[null, String | null]}
 */

async function help() {
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
/wiki {запрос} - возвращает подходящие страницы из википедии
/deep {запрос} - генерирует изображение по запросу с помощью DeepAI
`;
    return [null, message];
}

module.exports = {
    help,
}