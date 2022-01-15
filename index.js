const Discord = require('discord.js');
const config = require('./config.json');

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS] });

client.login(config.TOKEN);

client.once('ready', () => {
    console.log('Client is ready.');
});