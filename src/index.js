require('dotenv').config();

const logging = require('./logger.js');
const log = require("log4js").getLogger();

require('./prototypes.js');

const _ = require("lodash");
const Discord = require('discord.js');
const fs = require('fs');

const config = require("../res/config.json");
const util = require("./util.js");
const dominionsStatus = require("./dominionsStatus.js");
const domGame = require('./dominionsGame.js');

const lobbyCommandHandler = require('./lobbyCommands.js');
const gameCommandHandler = require('./gameCommands.js');

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
const GAMES_CATEGORY_NAME = process.env.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME;

function cleanup(){
    logging.shutdown();
    log.info('Goodbye');
}

process.on('cleanup',cleanup);

// do app specific cleaning before exiting
process.on('exit', function () {
  process.emit('cleanup');
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
    log.info('Ctrl-C...');
  process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function(e) {
    log.info(`Uncaught Exception... ${e} ${e.name}`);
    log.info(e.stack);
  process.exit(99);
});

bot.on('ready', () => {
    log.info(`Logged in as ${bot.user.tag}!`);
});

bot.on('message', msg => {
    if( msg.content.startsWith('!')){
        let handler = null;
        log.info(msg.channel.name);
        log.info(LOBBY_NAME);
        if (msg.channel.name == LOBBY_NAME) {
            log.info("Handling lobby command");
            handler = lobbyCommandHandler;
        }else{
            log.info("Handling game command");
            handler = gameCommandHandler;
        }
        let result = 0;
        msg.react(util.emoji(':thinking:')).then(r => {
            result = handler(msg);
        }).then( r => {
            msg.reactions.removeAll();
            if(result >= 0){
                msg.react(util.emoji(':thumbsup:'));
            }else{
                msg.react(util.emoji(':thumbsdown:'));
            }
        }).catch( err => {
            msg.reactions.removeAll();
            msg.react(util.emoji(':no_entry_sign:'))
            log.error(err);
        });
    }
});

bot.login(TOKEN).then(s => {
    util.loadAllGames(f => {
        log.info(`Restoring ${f}`)
        domGame.loadGame(f, bot, game => {
            domGame.hostGame(game);
            dominionsStatus.startWatches(game);
            if(game.state.nextTurnStartTime && game.state.nextTurnStartTime.getSecondsFromNow() > 60){
                log.info(`Next turn for ${game.name} scheduled at ${game.state.nextTurnStartTime}`);
                util.domcmd.startGame(game, game.state.nextTurnStartTime.getSecondsFromNow());
            }
        });
    });
}).catch(err => {
    log.error(err);
    throw err;
});