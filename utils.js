const axios = require('axios');
const config = require('./config.json');

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

module.exports = { get_currencies_list };