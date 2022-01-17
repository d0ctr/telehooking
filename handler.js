class WordleScheduler {
    constructor() {
        this.wordle_url = 'https://www.powerlanguage.co.uk/wordle/';
        this.event_name = "Угадывай слово";
        this.start_hour = 22;
        this.start_min = 0;
        this.event_duration_ms = (23 * 60 + 55) * 60 * 1000;
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
        now.setUTCSeconds(0, 0);

        if ((now.getUTCHours() == this.start_hour) && (now.getUTCMinutes() >= this.start_min) || (now.getUTCHours() > this.start_hour)) {
            now.setUTCDate(now.getUTCDate() + 1);
        }
        
        this.next_start = now.setUTCHours(this.start_hour, this.start_min);

        this.next_end = now.setTime(now.getTime() + this.event_duration_ms);

        await this._guild.scheduledEvents.create({
            name: this.event_name, 
            scheduledStartTime: this.next_start, 
            scheduledEndTime: this.next_end, 
            privacyLevel: 'GUILD_ONLY',
            entityType: 'EXTERNAL',
            entityMetadata: { location: this.wordle_url }
        });

        this._schedule_interval = setInterval(this._start_scheduling.bind(this), this.next_end - Date.now());
    }

}

let guild_to_wordle = {};

const wordle_handler = {
    'start': async (interaction) => {
        if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
            return interaction.reply('Scheduler is already running!');
        }

        if (!guild_to_wordle[interaction.guild.id]) guild_to_wordle[interaction.guild.id] = new WordleScheduler();
        await guild_to_wordle[interaction.guild.id].start(interaction.guild);
        
        return interaction.reply(`Starting Wordle scheduler\nNext Wordle is in ${Math.floor((guild_to_wordle[interaction.guild.id].next_start - Date.now()) / 60000)} mins, get ready!`);
    },
    'stop': async (interaction) => {
        if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
            guild_to_wordle[interaction.guild.id].stop();

            return interaction.reply('Stopped Wordle scheduler');
        }
        else {
            return interaction.reply('There is no running scheduler right now');
        }
    },
    'status': async (interaction) => {
        if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
            return interaction.reply(`There is currently running Wordle scheduler.\nNext Wordle is in ${Math.floor((guild_to_wordle[interaction.guild.id].next_start - Date.now()) / 60000)} mins, get ready!`);
        }
        else {
            return interaction.reply('There is no currently running Wordle scheduler.\nYou can start one with `/wordle start`');
        }
    },
    'clearall': async (interaction) => {
        let events = await interaction.guild.scheduledEvents.fetch();
        await events.forEach(async (event) => {
            await interaction.guild.scheduledEvents.delete(event);
        });
        return interaction.reply('All events are deleted');
    }
};

const handler = {
    'ping': async (interaction) => interaction.reply('pong'),
    'server': async (interaction) => {
        return interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
    },
    'user': async (interaction) => {
        return interaction.reply(`Your username: ${interaction.user.username}\nYour ID: ${interaction.user.id}`);
    },
    'wordle': async (interaction) => {
        if (!wordle_handler[interaction.options.getSubcommand()]) {
            return interaction.reply('There is no such command.');
        }
        return wordle_handler[interaction.options.getSubcommand()](interaction)

    }
};

async function handle_command(interaction) {
    if (!handler[interaction.commandName]) {
        return interaction.reply('There is no such command.');
    }
    return handler[interaction.commandName](interaction);
}

module.exports = handle_command;