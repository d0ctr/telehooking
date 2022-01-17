const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv');

dotenv.config();

const commands = [
	new SlashCommandBuilder() // ping
        .setName('ping')
        .setDescription('Replies with pong!'),

	new SlashCommandBuilder() // server
        .setName('server')
        .setDescription('Replies with server info!'),

	new SlashCommandBuilder() // user
        .setName('user')
        .setDescription('Replies with user info!'),

    new SlashCommandBuilder() // wordle
        .setName('wordle')
        .setDescription('Wordle scheduler')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start Wordle Scheduler'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('stop')
                .setDescription('Stop Wordle Scheduler'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('status')
                .setDescription('Show info about Wordle Scheduler'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('clearall')
                .setDescription('WARNING!!! Will clear all scheduled events'))
        
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);