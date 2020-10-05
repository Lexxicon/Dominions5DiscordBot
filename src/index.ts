require('dotenv').config();
require('source-map-support').install();
require('./Prototypes.js');

import { getLogger, shutdown } from 'log4js';
const log = getLogger();


log.info(``);
log.info(`-------------- Application Starting ${new Date()} --------------`);
log.info(``);

require('./ValidateEnv.js').validate();

import Discord, { NewsChannel, TextChannel } from 'discord.js';
import { getChannel, hostGame, loadGame } from './DominionsGame';
import * as dominionsStatus from './DominionsStatus';
import {processGameCommand} from './commands/GameCommandHandler';
import { GuildMessage } from './global';
import lobbyCommandHandler from './LobbyCommands';
import serverCommandHandler from './ServerCommands';
import util from "./Util";
import { loadAllCommands } from './commands/CommandLoader';


loadAllCommands();

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;;
const LOBBY_NAME = process.env.DEFAULT_LOBBY_NAME;

export function getDiscordBot(){
    return bot;
}

function cleanup(){
    log.info('Goodbye');
    shutdown();
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
    log.error(`Uncaught Exception... ${e} ${e.name}`);
    log.error(e.stack);
    cleanup();
    process.exit(99);
});

bot.on('ready', () => {
    log.info(`Logged in as ${bot?.user?.tag}!`);
});


bot.on('message', async msg => {
    if( msg.content.startsWith('!') && (msg.channel instanceof TextChannel || msg.channel instanceof NewsChannel) && util.isGuildMessage(msg)){

        log.info(msg.channel.name);
        await msg.react(util.emoji(':thinking:'));
        let handler: (msg: GuildMessage)=> Promise<number>;
        if (msg.channel.name == LOBBY_NAME) {
            log.info("Handling lobby command");
            handler = lobbyCommandHandler;
        }else if(msg.channel.parent?.name == `${process.env.DEFAULT_GAMES_CATEGORY_NAME}`){
            log.info("Handling game command");
            handler = processGameCommand;
        }else{
            log.info("Handling server command");
            handler = serverCommandHandler
        }
        try{
            let result = await handler(msg);
            await msg.reactions.removeAll();
            if(result >= 0){
                await msg.react(util.emoji(':thumbsup:'));
            }else{
                await msg.react(util.emoji(':thumbsdown:'));
            }
        } catch(err){
            log.error(err);
            await msg.reactions.removeAll();
            await msg.react(util.emoji(':no_entry_sign:'))
        }
    }
});

bot.login(TOKEN).then(s => {
    util.loadAllGames(async f => {
        try{
            log.info(`Restoring ${f}`)
            let game = await loadGame(f);
            let nextTurnStartTime = game.state.nextTurnStartTime;
            try{
                await hostGame(game);
                dominionsStatus.startWatches(game);
                if(nextTurnStartTime && nextTurnStartTime.getSecondsFromNow() > 60){
                    log.info(`Next turn for ${game.name} scheduled at ${nextTurnStartTime}`);
                    util.domcmd.startGame(game, nextTurnStartTime.getSecondsFromNow());
                }
            }catch(err){
                log.error(`Failed hosting game ${game.name}`);
                let channel = await getChannel(game);
                channel?.send(`Failed restoring game ${err}`);
            }
        }catch(err){
            log.error(`failed resoting ${f}, ${err}`);
        }
    });
}).catch(err => {
    log.error(err);
    throw err;
});