const Discord = require('discord.js');
const dotenv = require('dotenv');
const { handle_command, restore_wordle } = require('./handler');
const Redis = require('ioredis');

dotenv.config();

class BilderbergButler {
    constructor() {
        this.redis = new Redis(process.env.REDISCLOUD_URL);
        this.client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS] });
        
        this.client.once('ready', () => {
            console.log('Client is ready.');
            this.restore_data();
        });

        this.client.on('interactionCreate', async interaction => {
            console.log(`Received : ${interaction}`);
            
            if (!interaction.isCommand()) return;
            try {
                await handle_command(interaction, this);
            }
            catch (err) {
                console.error('Error while processing command: ', err);
                await interaction.editReply('Opps! Something broke on my side.');
            }
        });

    }

    start() {
        this.client.login(process.env.TOKEN);
    }

    async restore_data () {
        this.client.guilds.cache.map((guild) => {
            console.log(`Found my self in ${guild.id}`);
            console.log('Reviving database for ^^^')
            restore_wordle(guild, this);
        });
    }
}

let bilderbergButler = new BilderbergButler();
bilderbergButler.start();