class WordleScheduler {
    constructor() {
        this.wordle_url = 'https://www.powerlanguage.co.uk/wordle/';
        this.event_name = "Угадывай слово";
        this.running = false;
    }

    async start(guild) {
        if (this.running) return;
        if (!guild) return;
        this._guild = guild;

        await this._start_scheduling();
        
        this.running = true;
    }

    stop() {
        if(this._schedule_interval && this.running) {
            clearInterval(this._schedule_interval);
            this.running = false;
        }
    }

    async _start_scheduling() {
        let now = new Date();
        now.setUTCMinutes(0, 0, 0);

        if (now.getUTCHours() >= 22) {
            now.setUTCDate(now.getUTCDate() + 1);
        }
        
        this.next_start = now.setUTCHours(22);

        this.next_end = now.setUTCHours(now.getUTCHours() + 23, 55);

        await this._guild.scheduledEvents.create({
            name: this.event_name, 
            scheduledStartTime: this.next_start, 
            scheduledEndTime: this.next_end, 
            privacyLevel: 'GUILD_ONLY',
            entityType: 'EXTERNAL',
            entityMetadata: { location: this.wordle_url }
        });

        this._schedule_interval = setInterval(this._start_scheduling, this.next_end - Date.now());
    }

}

const wordleScheduler = new WordleScheduler();

let guild_to_wordle = {};

const handler = {
    'ping': async (interaction) => interaction.reply('pong'),
    'server': async (interaction) => {
        return interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
    },
    'user': async (interaction) => {
        return interaction.reply(`Your username: ${interaction.user.username}\nYour ID: ${interaction.user.id}`);
    },
    'wordle': async (interaction) => {
        if (interaction.options.getSubcommand() === 'start') {
            if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
                return interaction.reply('Scheduler is already running!');
            }

            guild_to_wordle[interaction.guild.id] = new WordleScheduler();
            await guild_to_wordle[interaction.guild.id].start(interaction.guild);
            return interaction.reply(`Starting new Wordle scheduler\nNext Wordle is in ${Math.floor((guild_to_wordle[interaction.guild.id].next_start - Date.now()) / 60000)} mins, get ready!`);
        }
        else if (interaction.options.getSubcommand() === 'stop') {
            if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
                wordleScheduler.stop();
                return interaction.reply('Stopped Wordle scheduler');
            }
            else {
                return interaction.reply('There is no running scheduler right now');
            }
        }


    }
};

async function handle_command(interaction) {
    if (!(interaction.commandName in handler)) {
        return;
    }

    await handler[interaction.commandName](interaction);
}

module.exports = handle_command;