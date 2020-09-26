require('dotenv').config();
require('./prototypes.js');

import Discord, { NewsChannel, TextChannel } from 'discord.js';
import { hostGame, loadGame } from './dominionsGame.js';
import dominionsStatus from "./dominionsStatus.js";
import gameCommandHandler from './gameCommands.js';
import lobbyCommandHandler from './lobbyCommands.js';
import logging from './logger.js';
import serverCommandHandler from './serverCommands.js';
import util from "./util.js";

const log = require("log4js").getLogger();
const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;;
const LOBBY_NAME = process.env.DEFAULT_LOBBY_NAME;

function cleanup(){
    log.info('Goodbye');
    logging.shutdown();
}

// do app specific cleaning before exiting
process.on('exit', function () {
    cleanup();
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
    log.info('Ctrl-C...');
    cleanup();
    process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function(e) {
    log.info(`Uncaught Exception... ${e} ${e.name}`);
    log.info(e.stack);
    cleanup();
    process.exit(99);
});

bot.on('ready', () => {
    log.info(`Logged in as ${bot?.user?.tag}!`);
});


bot.on('message', msg => {
    if( msg.content.startsWith('!') && (msg.channel instanceof TextChannel || msg.channel instanceof NewsChannel)){
        let handler;
        log.info(msg.channel.name);
        if (msg.channel.name == LOBBY_NAME) {
            log.info("Handling lobby command");
            handler = lobbyCommandHandler;
        }else if(msg.channel.parent?.name == `${process.env.DEFAULT_GAMES_CATEGORY_NAME}`){
            log.info("Handling game command");
            handler = gameCommandHandler;
        }else{
            log.info("Handling server command");
            handler = serverCommandHandler
        }

        let result = 0;
        msg.react(util.emoji(':thinking:')).then(r => {
            result = handler(msg);
        }).then( r => {
            msg.reactions.removeAll()
            .catch(err => {
                log.error(err);
            });
            if(result >= 0){
                msg.react(util.emoji(':thumbsup:'));
            }else{
                msg.react(util.emoji(':thumbsdown:'));
            }
        }).catch( err => {
            msg.reactions.removeAll()
            .then(() => {
                return msg.react(util.emoji(':no_entry_sign:'));
            })
            .catch(err => {
                log.error(err);
            })
            msg.react(util.emoji(':no_entry_sign:'))
            log.error(err);
        });
    }
});

bot.login(TOKEN).then(s => {
    util.loadAllGames(f => {
        log.info(`Restoring ${f}`)
        loadGame(f, bot, game => {
            hostGame(game);
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