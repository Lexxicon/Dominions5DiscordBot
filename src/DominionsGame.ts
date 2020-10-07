

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

    pid: number = 0;

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
        }
    }
}

_.forEach(require('parse-numeric-range')(process.env.PORTS), p => ports[p] = null);

function killGames() {
    log.info(`Killing Games`);
    _.keys(ports).forEach((key) => {
        let game:Game = ports[key];
        if(game){
            stopGame(game);
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
        let channel = await getChannel(game);
        if(!channel){
            return;
        }
        await channel.send(`<@&${game.discord.playerRoleId}> ${msg}`);
    }
}

function getBlockingNations(game: Game, staleNations: Snowflake[]) {
    if (!staleNations) staleNations = [];

    let blockingNations: string[] = [];
    for (let nationID in game.playerStatus) {
        let player = game.playerStatus[nationID];
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
    let channel = await getChannel(game);
    if(!channel) return;

    let staleNations = await util.getStaleNations(game);
    if (game.state.notifiedBlockers) {
        log.info(`Already notified ${game.name}`);
        return;
    }
    let blockingNations = getBlockingNations(game, staleNations);

    if (blockingNations.length == 0) {
        log.info(`No blocking players for ${game.name}`);
        return;
    }

    let playerIDs = blockingNations.map(v => getPlayerForNation(game, v));
    let ping = playerIDs.map((id) => id ? `<@${id}>`:``).join(' ');

    game.state.notifiedBlockers = true;
    await saveGame(game);
    await channel.send(`${ping}\nNext turn starts in ${util.getDisplayTime(game.state.nextTurnStartTime.getSecondsFromNow())}!`);
}

function handleStreamLines(outStream: Readable, handler: (line: string) => void) {
    const emitter = new EventEmitter.EventEmitter();

    let buffer = "";
    let lastEmit: Object[] = [];

    outStream
        .setEncoding('utf-8')
        .on('data', data => {
            buffer += data;
            let lines = buffer.split(/[\r\n|\n]/);
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

async function hostGame(game: Game) {
    log.info(`hosting: ${game.name}`);
    if (!game.settings.server.port) {
        let port = _.findKey(ports, p => p === null);
        if (port) {
            log.info(`Assigned port: ${port} to game: ${game.name}`);
            game.settings.server.port = Number(port);
            saveGame(game);
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
    log.info(`Spawning Host: ${process.env.DOMINION_EXEC_PATH} ${args}`)

    const child = spawn(`${process.env.DOMINION_EXEC_PATH}`, args, { stdio: 'pipe', detached: true });
    const timeRemainingRegex = /^\w*-\w*, Connections\s*(?<CONNECTIONS>\d+),\s*((?<PAUSED>No timer)|Time (?<TIME>\d+\w))\s*(\(quick host\))?$/
    let lastSeenTime = "";
    let lastSeenPause = false;
    handleStreamLines(child.stdout, (data) => {
        log.info(`[${game.name}] ${data}`);
        let timeLine = timeRemainingRegex.exec(data);
        if(timeLine?.groups){
            let time = timeLine.groups['TIME'];
            if(time && lastSeenTime != time){
                lastSeenTime = time;
                let secondsTilStart = util.getSeconds(timeLine.groups['TIME']);
                game.state.nextTurnStartTime = new Date().addSeconds(secondsTilStart);
                updateGameStatus(game);
            }
            let paused = timeLine.groups['PAUSED'] != undefined;
            if(lastSeenPause != paused){
                game.state.paused = paused;
                lastSeenPause = paused;
                updateGameStatus(game);
            }
        }
    });
    handleStreamLines(child.stderr, (data) => log.error(`[${game.name}] ${data}`));

    ports[game.settings.server.port] = game;
    child.on('error', (er) => {
        log.error(`child error ${er}`);
    });

    child.on('exit', (code, sig) => {
        log.warn(`Game exited! ${game.name}, ${code}, ${sig}`)
        delete game.getProcess;
        if (ports[game.settings.server.port!] === game) {
            ports[game.settings.server.port!] = null;
        }
    });
    log.debug(`Hosted ${game.name} with pid ${child.pid}`);
    game.getProcess = () => child;
    game.pid = child.pid;

    return Promise.withTimeout((resolve, reject) => {
        child.stdout.on('data', resolve);
        child.stdout.on('error', reject);
        child.stderr.on('data', reject);
        child.stderr.on('error', reject);
        child.on('exit', reject);
    }, 2000);
}

async function stopGame(game: Game) {
    log.info(`stopping ${game.name} ${game.pid}`)
    if (game.getProcess) {
        let proc = game.getProcess();
        let exited = Promise.withTimeout(resolve => proc.on('exit', resolve), 2000)
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

function unloadGame(game: Game) {
    log.info(`unloading: ${game.name} ${game.pid}`);
    stopGame(game);
    if (games[game.name] === game) {
        delete games[game.name];
        delete gamesByChannel[game.discord.channelId];
    }
}

async function deleteGame(game: Game) {
    log.info(`Deleting ${game.name} ${game.pid}`);
    let childProcess = game.getProcess ? game.getProcess() : null;
    unloadGame(game);
    let guild = await getGuild(game);
    if(guild){
        if (game.discord.playerRoleId) {
            await guild.roles.fetch(game.discord.playerRoleId)
                .then(r => r!.delete())
                .catch(log.error);
        }
        
        if (game.discord.adminRoleId) {
            await guild.roles.fetch(game.discord.adminRoleId)
                .then(r => r!.delete())
                .catch(log.error);
        }

        if (game.discord.channelId) {
            await guild.client.channels.fetch(game.discord.channelId)
                .then(c => {
                    c.delete()
                    delete gamesByChannel[game.discord.channelId];
                })
                .catch(log.error);
        }
    }
    let cleanup = () => {
        util.deleteGameSave(game);
        util.deleteJSON(game.name);
    };
    if (!childProcess) {
        //wait for the game to stop
        setTimeout(cleanup, 2000);
    } else {
        childProcess.on('exit', cleanup);
    }
}

async function loadGame(name: string) {
    let data = await util.loadJSON(name);
    log.info('Wrapping game');
    data = adaptGame(data);
    return wrapGame(data);
}

async function saveGame(game: Game) {
    return util.saveJSON(game.name, game);
}

export async function getChannel(game: Game){
    let bot = getDiscordBot();
    if(game.discord.channelId){
        let channel: any = bot.channels.fetch(game.discord.channelId);
        return channel as TextChannel & GuildChannel;
    }
    return null;
}

export async function getGuild(game: Game){
    let channel = await getChannel(game);
    if(channel?.guild){
        return channel.guild;
    }
    return null;
}

export function getPlayerForNation(game: Game, nationID: string){
    for (let userID in game.discord.players) {
        if (game.discord.players[userID] == nationID)
            return userID;
    }
    return null;
}


export async function getPlayerDisplayName(game: Game, nationId: string) {
    let playerId = getPlayerForNation(game, nationId);
    if (playerId) {
        let bot = getDiscordBot();
        let guild = await getGuild(game);
        if(guild){
            let guild = await getGuild(game);
            
            let guildMember = await guild?.member(playerId)?.fetch(true);
            
            if(guildMember){
                return guildMember.displayName;
            }
        }
        let player = await bot.users.fetch(playerId);
        if (player) {
            return player.username;
        } else {
            return 'Failed to load';
        }
    }
    return '-';
};

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
        args.push("--clustered")
    }
    args.push("--newgame")
    args = args.concat(constants.ERA[setup.era]);
    args = args.concat(constants.EVENTS[setup.eventRarity]);

    args.push(constants.STORY_EVENTS[setup.storyEvents]);
    for (let k in setup.slots) {
        args.push(constants.SLOTS[setup.slots[k]])
        args.push(k);
    }
    args.push(config.name);

    return args;
}

export {
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

