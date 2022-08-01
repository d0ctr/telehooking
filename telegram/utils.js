const axios = require('axios').default;
const config = require('../config.json');

/**
 * Gets a url for random ahegao
 * Source for ahegao is https://ahegao.netlify.app/ (https://github.com/egecelikci/ahegao)
 * @returns {String|null}
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

module.exports = { get_ahegao_url }