require('dotenv').config();
const Discord = require('discord.js');
const fs = require('fs');

const config = require("../res/config.json");
const util = require("./util.js");
const dominionsStatus = require("./dominionsStatus.js");

const lobbyCommandHandler = require('./lobbyCommands.js');

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const GAMES_CATEGORY_NAME = process.env.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME;


bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
});

bot.on('message', msg => {
    if (msg.channel.name === LOBBY_NAME && msg.content.startsWith('!')) {
        lobbyCommandHandler(msg);
        msg.react(util.emoji(':thumbsup:')).then(r => {
            msg.react(util.emoji(':thumbsdown:'))
        }).then( r => {
            msg.reactions.removeAll();
        });

        // fs.readFile('statusdump.txt', 'utf8', (err, data) => {
        //     if(err) throw err;
        //     const embed = dominionsStatus.createEmbeddedGameState(dominionsStatus.parseLines(data.split('\n')));
        //     msg.channel.send(embed);
        // });


    }
});

// bot.on('messageReactionAdd', (reaction, msg) => {
//     if(msg.channel.name === LOBBY_NAME){
//         console.info(reaction.emoji);
//         msg.reactions.resolve(reaction)
//     }
// });

// game = require("./dominionsGame.js");
// console.info(game.getArgs(game.create()));
bot.login(TOKEN);