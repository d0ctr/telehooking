const axios = require('axios').default;
const config = require('../config.json');

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

async function get_currencies_list() {
    let currencies = {};

    // get crypto
    let res_cryptocurrency = await axios.get(
        `${config.COINMARKETCAP_API}/v1/cryptocurrency/map`,
        {
            params: { listing_status: 'untracked,active' },
            headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_TOKEN }
        }
    );

    if (res_cryptocurrency.status !== 200 || res_cryptocurrency.data.status.error_code != 0) {
        new Error(`${res_cryptocurrency.data.status?.error_code == 0 ? res_cryptocurrency.data.status.error_message : res_cryptocurrency.statusText}`);
        return currencies;
    }

    for (let entry of res_cryptocurrency.data.data) {
        currencies[entry.symbol] = { 
            id: entry.id,
            name: entry.name,
            symbol: entry.symbol
        }
    }
    
    //get fiat
    let res_fiat = await axios.get(
        `${config.COINMARKETCAP_API}/v1/fiat/map`,
        {
            params: { include_metals: true },
            headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_TOKEN }
        }
    );

    if (res_fiat.status !== 200 || res_fiat.data.status.error_code != 0) {
        new Error(`${res_fiat.data.status?.error_code == 0 ? res_fiat.data.status.error_message : res_fiat.statusText}`);
        return currencies;
    }

    for (let entry of res_fiat.data.data) {
        currencies[entry.symbol] = { 
            id: entry.id,
            name: entry.name,
            symbol: entry.symbol
        }
    }

    return currencies;
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
    
    if (res.status !== 200 || res.data.status.error_code != 0) {
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

module.exports = { get_ahegao_url, get_urban_definition, get_currencies_list, get_conversion }