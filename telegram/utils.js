const axios = require('axios').default;
const config = require('../config.json');

const russian_alphabet_regex = /[а-яА-Я]+/gm;

/**
 * Convert definition by urban dictionary API to text HTML
 * @param {Object} definition 
 * @returns {String|undefined}
 */
function urban_to_html(definition) {
    if (!definition) {
        return;
    }
    definition.definition = _replace_with_link(definition.definition);
    definition.example = _replace_with_link(definition.example);

    let html = `<a href="${definition.permalink}">${definition.word}</a>

${definition.definition}

<i>${definition.example}</i>

${definition.thumbs_up} 👍|👎 ${definition.thumbs_down}`;
    return html;
}

/**
 * Replace `[arg]` with `<a href="urban dictionary/arg">arg</a>`
 * @param {String} line 
 */
function _replace_with_link(line) {
    let result = line;
    let matches = line.match(/\[[^\[\]]+\]/gm);
    for (let match of matches) {
        result = result.replace(match, `<a href="https://www.urbandictionary.com/define.php?term=${match.replace(/\[|\]/gm, '')}">${match.replace(/\[|\]/gm, '')}</a>`);
    }
    return result;
}

/**
 * Gets a url for random ahegao
 * Source for ahegao is https://ahegao.netlify.app/ [GitHub](https://github.com/egecelikci/ahegao)
 * @returns {Promise<String|null>}
 */
async function get_ahegao_url() {
    let result = null;
    let ahegao_req = await axios.get(config.AHEGAO_API);
    if (ahegao_req.status !== 200) {
        return result;
    }
    result = ahegao_req.data?.msg;
    return result;
}

/**
 * Get first definition from urban dictionary
 * @param {String|undefined} word 
 * @returns {Promise<String|null>}
 */
async function get_urban_definition(word) {
    let result = null;
    let endpoint = 'define';
    if (!word) {
        endpoint = 'random';
    }
    let urban_req = await axios.get(`${config.URBAN_API}/${endpoint}`, { params: { term: `${word}` } });
    if (urban_req.status !== 200) {
        return result;
    }
    
    result = urban_req.data?.list[0];

    return urban_to_html(result);
}

async function get_conversion(amount, from_id, to_id) {
    let result = null;

    let res = await axios.get(
        `${config.COINMARKETCAP_API}/v2/tools/price-conversion`,
        {
            params: { 
                amount: amount,
                id: from_id,
                convert_id: to_id 
            },
            headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_TOKEN }
        }
    );
    
    if (res.status !== 200) {
        new Error(`${res.data.status?.error_code == 0 ? res.data.status.error_message : res.statusText}`);
        return result;
    }

    if (!res.data.data.quote[to_id]?.price) {
        return result;
    }

    result = {
        [from_id]: Number(res.data.data.amount),
        [to_id]: Number(res.data.data.quote[to_id]?.price)
    }

    return result;
}

async function getWikipediaSummary(queryResult, locale) {
    let result = null;

    if (!queryResult || !locale) {
        return result;
    }

    let res = await axios.get(
        `${config.WIKIPEDIA_SUMMARY_URL[locale]}/${queryResult[1].split('/').pop()}`
    );

    if (res.status !== 200) {
        return result;
    }

    if (!res.data || !res.data.extract) {
        return result;
    }

    result = `<a href="${queryResult[1]}">${queryResult[0]}</a>\n\n${res.data.extract}`;

    return result;
}

async function searchWikipedia(query, locale = null) {
    let result = null; 
    if (!query) {
        return null;
    }

    if (!locale) {
        locale = query.match(russian_alphabet_regex) ? 'RU' : 'EN';
    }

    let res = await axios.get(
        config.WIKIPEDIA_SEARCH_URL[locale],
        {
            params: {
                action: 'opensearch',
                format: 'json',
                search: `${query}`,
                limit: 1
            }
        }
    );

    if (res.status !== 200) {
        return result;
    }

    if (!res.data || !res.data.length || res.data.length < 4 || !res.data[1].length || !res.data[3].length) {
        if (locale === 'RU') {
            return searchWikipedia(query, 'EN');
        }
        return result;
    }

    result = res.data.flat();

    result = [result[1], result[3]];

    return await getWikipediaSummary(result, locale);
}

module.exports = { get_ahegao_url, get_urban_definition, get_conversion, searchWikipedia }