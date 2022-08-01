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
    definition.definition = replace_with_link(definition.definition);
    definition.example = replace_with_link(definition.example);

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
function replace_with_link(line) {
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

module.exports = { get_ahegao_url, get_urban_definition }