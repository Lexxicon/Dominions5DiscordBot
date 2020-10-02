

import { ChildProcess, spawn } from 'child_process';
import { Channel, Client, Guild, GuildChannel, Snowflake, TextChannel } from "discord.js";
import EventEmitter from 'events';
import _, { Dictionary, NumericDictionary } from "lodash";
import { getLogger } from 'log4js';
import { Readable } from "stream";
import * as constants from './constants.js';
import { Era, EventRarity, MapOptions, SlotOptions, StoryEventLevel } from './global.js';
import util from './util.js';

const log = getLogger();

export class Game {
    name: string;
    playerCount = 0;
    state = {
        turn: -1,
        nextTurnStartTime: new Date(0),
        notifiedBlockers: false
    };
    playerStatus: any[] = [];
    settings = {
        server: {
            port: null as number | null
        },
        turns: {
            quickHost: true,
            maxTurnTime: 48 as number | undefined,
            maxTurnTimeMinutes: 2880
        },
        setup: {
            masterPass: Math.random().toString(36).substring(2, 15),
            era: 'MIDDLE' as Era,
            storyEvents: 'ALL' as StoryEventLevel,
            eventRarity: 'COMMON' as EventRarity,
            map: 'MEDIUM' as MapOptions | string,
            disciples: false,
            slots: {} as Dictionary<SlotOptions>,
            thrones: [5, 3, 2],
            victoryPoints: 8,
            cataclysm: 72,
            mods: [] as string[],
        }
    };
    discord = {
        channelId: "" as Snowflake,
        gameLobbyChannelId: null as Snowflake | null,
        turnStateMessageId: null as Snowflake | null,
        playerRoleId: null as Snowflake | null,
        adminRoleId: null as Snowflake | null,
        players: {} as Dictionary<string> //playerId : nationId
    };

    canary?: number;
    getProcess?: () => ChildProcess;
    getGuild?: any;
    getChannel?: (callback:(channel: TextChannel & GuildChannel)=>void)=>void;
    getGameLobby?: any;
    save?: any;
    getPlayerForNation?: any;
    getDisplayName?: any;
    update?: () => void;

    constructor(channel: GuildChannel, name: string, bot: Client) {
        this.name = name;
        this.discord = {
            channelId: channel.id,
            gameLobbyChannelId: null,
            turnStateMessageId: null,
            playerRoleId: null,
            adminRoleId: null,
            players: {
                //playerId : nationId
            }
        }
    }
}

const ports: NumericDictionary<Game | null> = {};

_.forEach(require('parse-numeric-range')(process.env.PORTS), p => ports[p] = null);

const games: Dictionary<Game> = {};

function killGames() {

    _.keys(ports).forEach((key) => {
        let game = ports[key];
        if (game !== null && game.getProcess) {
            log.info(`Killing ${key}`);
            game.getProcess().kill();
            delete game.getProcess;
        }
    });
}
process.on('cleanup', killGames);

function create(channel: GuildChannel, name: string, bot: Client) {
    const game: Game = {
        name: name,
        playerCount: 0,
        playerStatus: [],
        state: {
            turn: -1,
            nextTurnStartTime: new Date(0),
            notifiedBlockers: false
        },
        settings: {
            server: {
                port: null
            },
            turns: {
                quickHost: true,
                maxTurnTime: undefined,
                maxTurnTimeMinutes: 2880
            },
            setup: {
                masterPass: Math.random().toString(36).substring(2, 15),
                era: 'MIDDLE', //[EARLY=1, MIDDLE=2, LATE=3]
                storyEvents: 'ALL', //[NONE, SOME, ALL]
                eventRarity: 'COMMON', // [common=1, rare=2]
                map: 'MEDIUM', // [SMALL, MEDIUM, LARGE] or name of actual map
                disciples: false,
                slots: {},
                thrones: [5, 3, 2],
                victoryPoints: 8,
                cataclysm: 72,
                mods: []
            }
        },
        discord: {
            channelId: channel.id,
            gameLobbyChannelId: null,
            turnStateMessageId: null,
            playerRoleId: null,
            adminRoleId: null,
            players: {
                //playerId : nationId
            }
        }
    };
    log.info(`Created ${game.name}. Master Pass: ${game.settings.setup.masterPass}`);
    return wrapGame(game, bot);
}

function getGames() {
    return games;
}

function pingPlayers(game: Game, msg: string, cb) {
    if (game.discord.playerRoleId) {
        game.getChannel!((channel) => {
            channel.send(`<@&${game.discord.playerRoleId}> ${msg}`)
                .then(m => {
                    cb(m);
                })
                .catch(log.error);
        });
    }
}

function getBlockingNations(game: Game, staleNations: Snowflake[]) {
    if (!staleNations) staleNations = [];

    let blockingNations: number[] = [];
    for (let player of game.playerStatus) {
        if (player.playerStatus.canBlock && !player.turnState.ready && !staleNations.includes(player.stringId)) {
            blockingNations.push(player.nationId);
        }
    }
    if (blockingNations.length == 0) {
        log.info(`No blocking players for ${game.name}`);
        return [];
    }
    blockingNations.sort((a, b) => a - b);
    return blockingNations;
}

function pingBlockingPlayers(game: Game) {
    game.getGameLobby(channel => {
        util.getStaleNations(game, (err, staleNations) => {
            if (game.state.notifiedBlockers) {
                log.info(`Already notified ${game.name}`);
                return;
            }
            let blockingNations = getBlockingNations(game, staleNations);

            if (blockingNations.length == 0) {
                log.info(`No blocking players for ${game.name}`);
                return;
            }

            let playerIDs = blockingNations.map(game.getPlayerForNation);
            let ping = playerIDs.map(id => `<@${id}>`).join(' ');

            let hoursTillHost = Math.floor((game.state.nextTurnStartTime.getSecondsFromNow() / 60) / 60);

            game.state.notifiedBlockers = true;
            channel.send(`${ping}\nNext turn starts in ${hoursTillHost} hours!`);
            saveGame(game);
        });
    });
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

function hostGame(game: Game) {
    log.info(`hosting: ${game.name}`);
    if (!game.settings.server.port) {
        let port = _.findKey(ports, p => p === null);
        if (port) {
            log.info(`Assigned port: ${port} to game: ${game.name}`);
            game.settings.server.port = Number(port);
            game.save();
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

    const child = spawn(`${process.env.DOMINION_EXEC_PATH}`, args, { stdio: 'pipe' });
    handleStreamLines(child.stdout, (data) => log.info(`[${game.name}] ${data}`));
    handleStreamLines(child.stderr, (data) => log.error(`[${game.name}] ${data}`));

    ports[game.settings.server.port] = game;
    child.on('error', (er) => {
        log.error(`child error ${er}`);
    })
    
    const updateInterval = setInterval(() => {
        if(game.update){
            try{
                game.update();
            }catch(err){
                log.error(`Error updating game ${game.name} ${err}`);
            }
        }else{
            log.warn(`Skipping update for ${game.name}`);
        }
    }, 1000 * 60 * 15);
    child.on('exit', (code, sig) => {
        delete game.getProcess;
        if (ports[game.settings.server.port!] === game) {
            ports[game.settings.server.port!] = null;
        }
        clearInterval(updateInterval);
    });
    log.debug(`binding process on ${game.name} to ${child} ${child.pid}`);
    game.getProcess = () => child;
    game.canary = child.pid;
}

function stopGame(game: Game) {
    log.info(`stopping ${game.name} ${game.canary}`)
    if (game.getProcess) {
        game.getProcess().kill();
        delete game.getProcess;
    }
    if (ports[game.settings.server.port!] === game) {
        ports[game.settings.server.port!] = null;
    }
}

function unloadGame(game: Game) {
    log.info(`unloading: ${game.name} ${game.canary}`);
    stopGame(game);
    if (games[game.name] === game) {
        delete games[game.name];
    }
}

function deleteGame(game: Game) {
    log.info(`Deleting ${game.name} ${game.canary}`);
    let childProcess = game.getProcess ? game.getProcess() : null;
    unloadGame(game);
    game.getGuild(guild => {
        if (game.discord.playerRoleId) {
            guild.roles.fetch(game.discord.playerRoleId)
                .then(r => r.delete())
                .catch(log.error);
        }
        
        if (game.discord.adminRoleId) {
            guild.roles.fetch(game.discord.adminRoleId)
                .then(r => r.delete())
                .catch(log.error);
        }

        if (game.discord.channelId) {
            guild.client.channels.fetch(game.discord.channelId)
                .then(c => c.delete())
                .catch(log.error);
        }

        if (game.discord.gameLobbyChannelId) {
            guild.client.channels.fetch(game.discord.gameLobbyChannelId)
                .then(c => c.delete())
                .catch(log.error);
        }
    });
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

function loadGame(name, bot, cb) {
    util.loadJSON(name, (data, err) => {
        log.info('Wrapping game');
        if (err) throw `Error ${err}`;
        cb(wrapGame(data, bot));
    });
}

function saveGame(game: Game) {
    util.saveJSON(game.name, game);
}

function wrapGame(game: Game, bot: Client) {
    if (game.state.nextTurnStartTime) {
        game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime);
    }

    if (!game.settings.setup.mods) {
        game.settings.setup.mods = [];
    }

    let channel: (TextChannel & GuildChannel) | null = null;
    game.getChannel = (cb) => {
        if (channel === null) {
            bot.channels.fetch(game.discord.channelId, true)
                .then((c:any) => {
                    channel = c;
                    cb(c);
                })
                .catch(log.error);
        } else {
            cb(channel);
        }
    }

    let gameLobby: Channel | null = null;
    game.getGameLobby = (cb) => {
        if (gameLobby === null) {
            bot.channels.fetch(game.discord.gameLobbyChannelId!, true)
                .then(c => {
                    gameLobby = c;
                    cb(c);
                })
                .catch(log.error);
        } else {
            cb(gameLobby);
        }
    }

    let guild: Guild | null = null;
    game.getGuild = (cb) => {
        if (guild === null) {
            game.getChannel!(ch => {
                guild = ch.guild;
                cb(guild);
            });
        } else {
            cb(guild);
        }
    }
    game.save = () => { saveGame(game) };
    game.getPlayerForNation = (nationId) => {
        for (let userID in game.discord.players) {
            if (game.discord.players[userID] == nationId)
                return userID;
        }
        return null;
    };
    game.getDisplayName = (nationId) => {
        let playerId = game.getPlayerForNation(nationId);
        if (playerId) {
            let player = bot.users.cache.get(playerId);
            if (!player) {
                bot.users.fetch(playerId, true);
                return 'Loading...';
            } else {
                return player.username;
            }
        }
        return '-';
    };

    for (let userID in game.discord.players) {
        bot.users.fetch(userID, true);
    }

    games[game.name] = game;

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
    if (turns.maxTurnTime) {
        args.push("--hours");
        args.push(turns.maxTurnTime);
    } else if (turns.maxTurnTimeMinutes > 0) {
        args.push("--minutes");
        args.push(turns.maxTurnTimeMinutes);
    }

    //new game settings
    args.push("--noclientstart");
    args.push("--masterpass");
    args.push(setup.masterPass);
    args.push("--thrones", setup.thrones[0], setup.thrones[1], setup.thrones[2]);
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
    getGames
};

