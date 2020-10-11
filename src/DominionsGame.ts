

import { ChildProcess, spawn } from 'child_process';
import { Channel, GuildChannel, Snowflake, TextChannel } from "discord.js";
import EventEmitter from 'events';
import _, { Dictionary, NumericDictionary } from "lodash";
import { getLogger } from 'log4js';
import { Readable } from "stream";
import { getDiscordBot } from '.';
import * as constants from './Constants';
import { PlayerStatus, updateGameStatus } from './DominionsStatus';
import { Era, EventRarity, MapOptions, SlotOptions, StoryEventLevel } from './global';
import { adaptGame, GAME_BINARY_VERSION } from './LegacyGameConverter';
import util from './Util';
import numericRange from 'parse-numeric-range';
import { promises } from 'fs';

const log = getLogger();
const ports: NumericDictionary<Game | null> = {};
const games: Dictionary<Game> = {};
const gamesByChannel: Dictionary<Game> = {};


export class Game {
    version = GAME_BINARY_VERSION;
    name: string;
    playerCount = 0;
    state = {
        turn: -1,
        nextTurnStartTime: new Date(0),
        notifiedBlockers: false,
        paused: false
    };
    playerStatus: PlayerStatus[] = [];
    settings = {
        server: {
            port: null as number | null,
            masterPass: Math.random().toString(36).substring(2, 15)
        },
        turns: {
            quickHost: true,
            paused: false,
            maxTurnTimeMinutes: 2880,
            maxHoldUps: 2
        },
        setup: {
            era: 'MIDDLE' as Era,
            storyEvents: 'ALL' as StoryEventLevel,
            eventRarity: 'COMMON' as EventRarity,
            map: 'MEDIUM' as MapOptions | string,
            disciples: false,
            slots: {} as Dictionary<SlotOptions>,
            thrones: {
                level1: -1,
                level2: -1,
                level3: -1
            },
            victoryPoints: -1,
            cataclysm: 72,
            mods: [] as string[],
        }
    };
    discord = {
        channelId: "" as Snowflake,
        turnStateMessageId: null as Snowflake | null,
        playerRoleId: null as Snowflake | null,
        adminRoleId: null as Snowflake | null,
        players: {} as Dictionary<string> //playerId : nationId
    };

    getProcess?: () => ChildProcess;

    pid = 0;

    constructor(channel: GuildChannel, name: string) {
        this.name = name;
        this.discord = {
            channelId: channel.id,
            turnStateMessageId: null,
            playerRoleId: null,
            adminRoleId: null,
            players: {
                //playerId : nationId
            }
        };
    }
}

_.forEach(numericRange(process.env.PORTS), p => ports[p] = null);

function killGames() {
    log.info(`Killing Games`);
    _.keys(ports).forEach((key) => {
        const game:Game = ports[key];
        if(game){
            stopGame(game).catch(err => log.error(`Error stopping game ${game.name}, ${err} ${err?.stack}`));
        }
    });
}
process.on('exit', killGames);

function create(channel: GuildChannel, name: string) {
    const game = new Game(channel, name);
    log.info(`Created ${game.name}. Master Pass: ${game.settings.server.masterPass}`);
    return wrapGame(game);
}

function getGames() {
    return games;
}

function getGameByChannel(channel: Channel){
    return gamesByChannel[channel.id];
}

async function pingPlayers(game: Game, msg: string) {
    if (game.discord.playerRoleId) {
        const channel = await getChannel(game);
        if(!channel){
            return;
        }
        await channel.send(`<@&${game.discord.playerRoleId}> ${msg}`);
    }
}

function getBlockingNations(game: Game, staleNations: Snowflake[]) {
    if (!staleNations) staleNations = [];

    const blockingNations: string[] = [];
    for (const nationID in game.playerStatus) {
        const player = game.playerStatus[nationID];
        if (player.playerStatus.canBlock && !player.turnState.ready && !staleNations.includes(player.stringId)) {
            blockingNations.push(`${player.nationId}`);
        }
    }
    if (blockingNations.length == 0) {
        log.info(`No blocking players for ${game.name}`);
        return [];
    }
    blockingNations.sort((a, b) => Number(a) - Number(b));
    return blockingNations;
}

async function pingBlockingPlayers(game: Game) {
    const channel = await getChannel(game);
    if(!channel) return;

    const staleNations = await util.getStaleNations(game);
    if(game.state.nextTurnStartTime.getSecondsFromNow() < 60){
        log.info(`Too little time remaining to ping stale nations for ${game.name}`);
        return;
    }
    if (game.state.notifiedBlockers) {
        log.info(`Already notified ${game.name}`);
        return;
    }
    const blockingNations = getBlockingNations(game, staleNations);

    if (blockingNations.length == 0) {
        log.info(`No blocking players for ${game.name}`);
        return;
    }

    const playerIDs = blockingNations.map(v => getPlayerForNation(game, v));
    const ping = playerIDs.map((id) => id ? `<@${id}>`:``).join(' ');

    game.state.notifiedBlockers = true;
    await saveGame(game);
    await channel.send(`${ping}\nNext turn starts in ${util.getDisplayTime(game.state.nextTurnStartTime.getSecondsFromNow())}!`);
}

function handleStreamLines(outStream: Readable, handler: (line: string) => void) {
    const emitter = new EventEmitter.EventEmitter();

    let buffer = "";
    let lastEmit: any[] = [];

    outStream
        .setEncoding('utf-8')
        .on('data', data => {
            buffer += data;
            const lines = buffer.split(/[\r\n|\n]/);
            buffer = lines.pop() || '';
            lines.forEach(line => emitter.emit('line', line));
        })
        .on('end', () => {
            if (buffer.length > 0) emitter.emit('line', buffer);
        });

    emitter.on('line', data => {
        if (!lastEmit.includes(data)) {
            lastEmit.unshift(data);
            lastEmit = lastEmit.slice(0, 3);
            handler(data);
        }
    });
}

function getPorts(){
    return ports;
}

async function hostGame(game: Game) {
    log.info(`hosting: ${game.name}`);
    if (!game.settings.server.port) {
        const port = _.findKey(ports, p => p === null);
        if (port) {
            log.info(`Assigned port: ${port} to game: ${game.name}`);
            game.settings.server.port = Number(port);
            await saveGame(game);
        } else {
            throw `Failed to host! No available ports! Game: ${game.name}`;
        }
    }

    if (ports[game.settings.server.port] !== null) {
        if (ports[game.settings.server.port] === game) {
            log.warn(`Game seems already hosted. Game: ${game.name}, Port: ${game.settings.server.port}`);
        } else if (ports[game.settings.server.port]) {
            throw `A game is already hosted on port! Other Game: ${ports[game.settings.server.port]?.name}, Port: ${game.settings.server.port}`;
        } else {
            throw `Port is not available! Port: ${game.settings.server.port}`;
        }
    }

    const args = getLaunchArgs(game);
    log.info(`Spawning Host: ${process.env.DOMINION_EXEC_PATH} ${args}`);

    const child = spawn(`${process.env.DOMINION_EXEC_PATH}`, args, { stdio: 'pipe', detached: true });
    const timeRemainingRegex = /^\w*-\w*, Connections\s*(?<CONNECTIONS>\d+),\s*((?<PAUSED>No timer)|Time (?<TIME>\d+\w))\s*(\(quick host\))?$/;
    let lastSeenTime = "";
    let lastSeenPause = false;
    handleStreamLines(child.stdout, async (data) => {
        log.info(`[${game.name}] ${data}`);
        const timeLine = timeRemainingRegex.exec(data);
        if(timeLine?.groups){
            const time = timeLine.groups['TIME'];
            if(time && lastSeenTime != time){
                lastSeenTime = time;
                const secondsTilStart = util.getSeconds(timeLine.groups['TIME']);
                game.state.nextTurnStartTime = new Date().addSeconds(secondsTilStart);
                await updateGameStatus(game);
            }
            const paused = timeLine.groups['PAUSED'] != undefined;
            if(lastSeenPause != paused){
                game.state.paused = paused;
                lastSeenPause = paused;
                await updateGameStatus(game);
            }
        }
    });
    handleStreamLines(child.stderr, (data) => log.error(`[${game.name}] ${data}`));

    ports[game.settings.server.port] = game;
    child.on('error', (er) => {
        log.error(`child error ${er}`);
    });

    child.on('exit', (code, sig) => {
        log.warn(`Game exited! ${game.name}, ${code}, ${sig}`);
        delete game.getProcess;
        if (ports[game.settings.server.port!] === game) {
            ports[game.settings.server.port!] = null;
        }
    });
    log.debug(`Hosted ${game.name} with pid ${child.pid}`);
    game.getProcess = () => child;
    game.pid = child.pid;

    await Promise.withTimeout((resolve, reject) => {
        child.stdout.on('data', resolve);
        child.stdout.on('error', reject);
        child.stderr.on('data',  reject);
        child.stderr.on('error', reject);
                child.on('exit', reject);
    }, 10000);
}

async function stopGame(game: Game) {
    log.info(`stopping ${game.name} ${game.pid}`);
    if (game.getProcess) {
        const proc = game.getProcess();
        const exited = Promise.withTimeout(resolve => proc.on('exit', resolve), 2000)
            .catch(reason => { log.warn(`Error waiting for ${game.name} to stop. ${reason}`);
        });
        process.kill(-game.getProcess().pid);
        await exited;
        log.debug(`game exited`);
    }
    if (ports[game.settings.server.port!] === game) {
        ports[game.settings.server.port!] = null;
    }
}

async function unloadGame(game: Game) {
    log.info(`unloading: ${game.name} ${game.pid}`);
    await stopGame(game);
    if (games[game.name] === game) {
        delete games[game.name];
        delete gamesByChannel[game.discord.channelId];
    }
}

async function deleteGame(game: Game) {
    log.info(`Deleting ${game.name} ${game.pid}`);
    const childProcess = game.getProcess ? game.getProcess() : null;
    const exitPromise = Promise.withTimeout(resolve => childProcess?.on('exit', resolve), 2000);
    log.debug(`unloading`);
    await unloadGame(game);
    log.debug(`await exit`);
    await exitPromise;
    await util.deleteGameSave(game);
    await util.deleteJSON(game.name);
    const guild = await getGuild(game);

    if(guild){
        if (game.discord.playerRoleId) {
            log.debug(`deleting player role`);
            const role = await guild.roles.fetch(game.discord.playerRoleId);
            await role?.delete();
        }
        
        if (game.discord.adminRoleId) {
            log.debug(`deleting admin role`);
            const role = await guild.roles.fetch(game.discord.adminRoleId);
            await role?.delete();
        }

        if (game.discord.channelId) {
            log.debug(`deleting channel`);
            const chan = await guild.client.channels.fetch(game.discord.channelId);
            new Promise(r => setTimeout(r, 10000)).then(() => chan.delete()).catch(error => {throw new Error(error);});
            delete gamesByChannel[game.discord.channelId];
        }
    }
}

async function loadGame(name: string) {
    let data = await util.loadJSON(name);
    log.info('Wrapping game');
    data = adaptGame(data);
    return wrapGame(data);
}

function saveGame(game: Game) {
    return util.saveJSON(game.name, game);
}

export async function getChannel(game: Game){
    const bot = getDiscordBot();
    if(game.discord.channelId){
        const channel: any = await bot.channels.fetch(game.discord.channelId);
        return channel as TextChannel & GuildChannel;
    }
    return null;
}

export async function getGuild(game: Game){
    const channel = await getChannel(game);
    if(channel?.guild){
        return channel.guild;
    }
    return null;
}

export function getPlayerForNation(game: Game, nationID: string){
    for (const userID in game.discord.players) {
        if (game.discord.players[userID] == nationID)
            return userID;
    }
    return null;
}


export async function getPlayerDisplayName(game: Game, nationId: string) {
    const playerId = getPlayerForNation(game, nationId);
    if (playerId) {
        const bot = getDiscordBot();
        const guild = await getGuild(game);
        if(guild){
            const guild = await getGuild(game);
            
            const guildMember = await guild?.member(playerId)?.fetch(true);
            
            if(guildMember){
                return guildMember.displayName;
            }
        }
        const player = await bot.users.fetch(playerId);
        if (player) {
            return player.username;
        } else {
            return 'Failed to load';
        }
    }
    return '-';
}

function wrapGame(game: Game) {
    if (game.state.nextTurnStartTime) {
        game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime);
    }

    games[game.name] = game;
    gamesByChannel[game.discord.channelId] = game;

    return game;
}

function getLaunchArgs(config: Game) {
    const server = config.settings.server;
    const turns = config.settings.turns;
    const setup = config.settings.setup;

    if (!server.port) throw `No port defined for ${config.name}`;

    let args: any[] = [];
    // --- standard launch args ---
    args.push("--nosound");
    args.push("--nosteam");
    args.push("--textonly");

    // --- server settings ---
    args.push("--tcpserver");
    args.push("--port");
    args.push(server.port);
    args.push("--statusdump");

    // --- turn settings ---
    if (!turns.quickHost) args.push("--noquickhost");
    
    if (turns.maxTurnTimeMinutes > 0 && !turns.paused) {
        args.push("--minutes");
        args.push(turns.maxTurnTimeMinutes);
    }

    //new game settings
    args.push("--noclientstart");
    args.push("--masterpass");
    args.push(server.masterPass);
    args.push("--thrones", `${setup.thrones.level1}`, `${setup.thrones.level2}`, `${setup.thrones.level3}`);
    if (setup.victoryPoints) {
        args.push("--requiredap");
        args.push(setup.victoryPoints);
    }
    if (setup.cataclysm) {
        args.push("--cataclysm");
        args.push(setup.cataclysm);
    }
    if (constants.SIMPLE_RAND_MAP[setup.map]) {
        args = args.concat(constants.SIMPLE_RAND_MAP[setup.map]);
        args.push('--seapart');
        args.push('15');
    } else {
        args.push("--mapfile");
        args.push(setup.map);
    }
    if (setup.mods && setup.mods.length > 0) {
        setup.mods.forEach(mod => args.push("--enablemod", mod));
    } else {
        args.push("--nomods");
    }
    if (setup.disciples) {
        args.push("--teamgame");
        args.push("--clustered");
    }
    args.push("--newgame");
    args = args.concat(constants.ERA[setup.era]);
    args = args.concat(constants.EVENTS[setup.eventRarity]);

    args.push(constants.STORY_EVENTS[setup.storyEvents]);
    for (const k in setup.slots) {
        args.push(constants.SLOTS[setup.slots[k]]);
        args.push(k);
    }
    args.push(config.name);

    return args;
}

export {
    getPorts,
    create,
    getLaunchArgs,
    loadGame,
    stopGame,
    saveGame,
    hostGame,
    pingPlayers,
    pingBlockingPlayers,
    getBlockingNations,
    deleteGame,
    getGames,
    getGameByChannel
};

