const WordleScheduler = require('./wordle-scheduler');

let guild_to_wordle = {};

const wordle_handler = {
    'start': async (interaction, app) => {
        if (guild_to_wordle[interaction.guild.id] && guild_to_wordle[interaction.guild.id].running) {
            return interaction.reply('Scheduler is already running!');
        }

        await interaction.deferReply();

        if (!guild_to_wordle[interaction.guild.id]) guild_to_wordle[interaction.guild.id] = new WordleScheduler(app);
        await guild_to_wordle[interaction.guild.id].start(interaction.guild);
        if (guild_to_wordle[interaction.guild.id].next_start) {
            return interaction.editReply(`Starting Wordle scheduler\nNext Wordle is in ${Math.floor((guild_to_wordle[interaction.guild.id].next_start - Date.now()) / 60000)} mins, get ready!`);
        }
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
    },
    'whitelist': async (interaction) => {
        await interaction.deferReply();
        let events = await interaction.guild.scheduledEvents.fetch();
        await events.forEach(async (event) => {
            await interaction.guild.scheduledEvents.delete(event);
        });
        if (guild_to_wordle[interaction.guild.id]) {
            guild_to_wordle[interaction.guild.id].stop();
            guild_to_wordle[interaction.guild.id].delete_dump();
            delete guild_to_wordle[interaction.guild.id];
        }

        return interaction.editReply('Completed.');
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
    'wordle': async (interaction, app) => {
        if (!wordle_handler[interaction.options.getSubcommand()]) {
            return interaction.reply('There is no such command.');
        }
        return wordle_handler[interaction.options.getSubcommand()](interaction, app)

    }
};

async function handle_command(interaction, app) {
    if (!handler[interaction.commandName]) {
        return interaction.reply('There is no such command.');
    }
    return handler[interaction.commandName](interaction, app);
}

async function restore_wordle(guild, app) {
    if (guild_to_wordle[guild.id]) {
        console.log(`There is an active Wordle instance for ${guild.id}, no need for restoration`);
        return;
    }
    if (!app.redis) {
        console.log("Hey! I can't revive without redis instance!");
        return;
    }

    guild_to_wordle[guild.id] = new WordleScheduler(app);
    guild_to_wordle[guild.id].restore(guild);
}

module.exports = { handle_command, restore_wordle };