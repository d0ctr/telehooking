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
            console.log(`Received: ${JSON.stringify(this.parse_interaction_info(interaction))}`);
            
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
            console.log(`Found my self in ${guild.name}:${guild.id}`);
            console.log('Reviving database for ^^^')
            restore_wordle(guild, this);
        });
    }
    
    parse_interaction_info (interaction) {
        let info = {};
        if (interaction.guild) {
            info = {
                ...info,
                guild_name: interaction.guild.name,
                guild_id: interaction.guild.id
            };
        }
        
        if (interaction.member) {
            info = {
                ...info,
                member_name: interaction.member.displayName,
                member_id: interaction.member.id
            };
        }
        
        if (interaction.user) {
            info = {
                ...info,
                user_id: interaction.user.id,
                user_name: interaction.user.username,
                user_tag: interaction.user.tag
            };
        }
        
        if (interaction.commandName) {
            info = {
                ...info,
                command_name: interaction.commandName
            };
            if (interaction.options.getSubcommand(false)) {
                info = {
                    ...info,
                    subcommand_name: interaction.options.getSubcommand()
                };
            }
        }
        
        let result = {};
        
        for (let key in info) {
            if (info[key] !== undefined) result[key] = info[key];
        }
        
        return result;
    }
}

let bilderbergButler = new BilderbergButler();
bilderbergButler.start();
