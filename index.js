const Discord = require('discord.js');
const dotenv = require('dotenv');
const handle_command = require('./handler');

dotenv.config();

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS] });

client.once('ready', () => {
    console.log('Client is ready.');
    
    console.log(client.guilds.cache.map(guild => guild.id));
});

client.on('interactionCreate', async interaction => {
    console.log(`Received : ${interaction}`);
    
    if (!interaction.isCommand()) return;
    
    await handle_command(interaction);
});


client.login(process.env.TOKEN);