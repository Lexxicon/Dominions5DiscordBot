require('dotenv').config();
const Discord = require('discord.js');
const fs = require('fs');

const config = require("../res/config.json");
const util = require("./util.js");
const dominionsStatus = require("./dominionsStatus.js");

const lobbyCommandHandler = require('./lobbyCommands.js');

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
const GAMES_CATEGORY_NAME = process.env.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME;


bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
});

bot.on('message', msg => {
    if (msg.channel.name === LOBBY_NAME && msg.content.startsWith('!')) {
        msg.react(util.emoji(':thumbsup:')).then(r => {
            lobbyCommandHandler(msg);
        }).then( r => {
            msg.reactions.removeAll();
        }).catch( err => {
            msg.reactions.removeAll();
            msg.react(util.emoji(':thumbsdown:'))
        });
    }
});
bot.login(TOKEN);