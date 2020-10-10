import {config} from 'dotenv';
import {install} from 'source-map-support';

config();
install();

require('./Prototypes.js');

import { getLogger, shutdown } from 'log4js';
const log = getLogger();


log.info(``);
log.info(`-------------- Application Starting ${new Date()} --------------`);
log.info(``);

import { validate } from './ValidateEnv';
validate();

import Discord, { NewsChannel, TextChannel } from 'discord.js';
import { getChannel, hostGame, loadGame } from './DominionsGame';
import * as dominionsStatus from './DominionsStatus';
import {processGameCommand} from './commands/GameCommandHandler';
import { GuildMessage } from './global';
import lobbyCommandHandler from './LobbyCommands';
import serverCommandHandler from './ServerCommands';
import util from "./Util";
import { loadAllCommands } from './commands/CommandLoader';


loadAllCommands().catch(error =>{ throw new Error(error); });

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
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

process.on('unhandledRejection', (reason: any, p) => {
    log.error(`Unhandled Rejection at: Promise ${p} reason: ${reason} stack: ${reason?.stack}`);
});

bot.on('ready', () => {
    log.info(`Logged in as ${bot?.user?.tag}!`);
});

function restoreAllGames(){
    util.loadAllGames().then(games => {
        for(const game of games){
            restoreGame(game).catch(error => log.error(`Error restoring: ${error} ${error?.stack}`));
        }
    }).catch(error => log.error(`Error restoring all games ${error} ${error?.stack}`));
}

async function restoreGame(f: string){
    try{
        log.info(`Restoring ${f}`);
        const game = await loadGame(f);
        log.info(`Loaded ${game.name}`);
        const nextTurnStartTime = game.state.nextTurnStartTime;
        try{
            await hostGame(game);
            await dominionsStatus.startWatches(game);
            if(nextTurnStartTime && nextTurnStartTime.getSecondsFromNow() > 60){
                log.info(`Next turn for ${game.name} scheduled at ${nextTurnStartTime}`);
                await util.domcmd.startGame(game, nextTurnStartTime.getSecondsFromNow());
            }
        }catch(err){
            log.error(`Failed hosting game ${game.name}`);
            const channel = await getChannel(game);
            await channel?.send(`Failed restoring game ${err}`);
        }
    }catch(err){
        log.error(`Failed resoting ${f}, ${err}`);
    }
}

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
            handler = serverCommandHandler;
        }
        try{
            const result = await handler(msg);
            await msg.reactions.removeAll();
            if(result >= 0){
                await msg.react(util.emoji(':thumbsup:'));
            }else{
                await msg.react(util.emoji(':thumbsdown:'));
            }
        } catch(err){
            log.error(err);
            await msg.reactions.removeAll();
            await msg.react(util.emoji(':no_entry_sign:'));
        }
    }
});

bot.login(TOKEN).then(() => {
    restoreAllGames();
}).catch(err => {
    log.error(err);
});