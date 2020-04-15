require('dotenv').config();
const _ = require("lodash");
const Discord = require('discord.js');
const fs = require('fs');

const config = require("../res/config.json");
const util = require("./util.js");
const dominionsStatus = require("./dominionsStatus.js");
const domGame = require('./dominionsGame.js');

const lobbyCommandHandler = require('./lobbyCommands.js');

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
const GAMES_CATEGORY_NAME = process.env.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME;

function cleanup(){
    console.info('Goodbye');
}

process.on('cleanup',cleanup);

// do app specific cleaning before exiting
process.on('exit', function () {
  process.emit('cleanup');
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
  console.log('Ctrl-C...');
  process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function(e) {
  console.log('Uncaught Exception...');
  console.log(e.stack);
  process.exit(99);
});

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
            console.error(err);
        });
    }
});

bot.login(TOKEN).then(s => {
    util.loadAllGames(f => {
        console.info(`Restoring ${f}`)
        domGame.loadGame(f, bot, game => {
            domGame.hostGame(game);
            dominionsStatus.startWatches(game);
        });
    });
});