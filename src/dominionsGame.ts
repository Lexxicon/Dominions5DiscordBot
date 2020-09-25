const log = require("log4js").getLogger();

import _ from "lodash";
import EventEmitter from 'events';

import {spawn} from 'child_process';

import CONSTANTS from "./constants.js";
import util from './util.js';

const ports = {};
_.forEach(require('parse-numeric-range')(process.env.PORTS), p => ports[p] = null);

const games = {};

function killGames(){

    _.keys(ports).forEach((key) => {
        if(ports[key]?.getProcess){
            log.info(`Killing ${key}`);
            ports[key].getProcess().kill();
            delete ports[key].getProcess;
        }
    });
}
process.on('cleanup',killGames);

function create(channel, name, bot){
    const game = {
        name: name,
        playerCount: 0,
        playerStatus: [],
        state: {
            turn: -1,
            nextTurnStartTime: 0,
            notifiedBlockers: false
        },
        settings: {
            server: {
                port: null
            },
            turns:{
                quickHost: true,
                maxTurnTime: 48,
                maxHoldups: 2,
            },
            setup: {
                masterPass: Math.random().toString(36).substring(2, 15),
                era: 'MIDDLE', //[EARLY=1, MIDDLE=2, LATE=3]
                storyEvents: 'ALL', //[NONE, SOME, ALL]
                eventRarity: 'COMMON', // [common=1, rare=2]
                map: 'MEDIUM', // [SMALL, MEDIUM, LARGE] or name of actual map
                slots: { //nationID: difficulty
                    // 8: 'DIFFICULT', //--diffai
                    // 9: 'MIGHTY', //--mightyai
                    // 10: 'MASTER', //--masterai
                    // 11: 'IMPOSSIBLE', //--impai
                    // 12: 'BANNED' //--closed
                },
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
            pingMessageId: null,
            playerRoleId: null,
            players:{
                //playerId : nationId
            }
        }
    };
    log.info(`Created ${game.name}. Master Pass: ${game.settings.setup.masterPass}`);
    return wrapGame(game, bot);
}

function getGames(){
    return games;
}

function pingPlayers(game, msg, cb){
    if(game.discord.playerRoleId){
        game.getChannel(channel => {
            channel.send(`<@&${game.discord.playerRoleId}> ${msg}`)
                .then(m => {
                    if(game.discord.pingMessageId){
                        channel.messages
                        .delete(game.discord.pingMessageId)
                        .catch(log.error);
                    }
                    game.discord.pingMessageId = m.id;
                    cb(m);
                })
                .catch(log.error);
        });
    }
}

function getBlockingNations(game, staleNations){
    if(!staleNations) staleNations = [];

    let blockingNations : number[] = [];
    for(let player of game.playerStatus){
        if(player.playerStatus.canBlock && !player.turnState.ready && !staleNations.includes(player.stringId)){
            blockingNations.push(player.nationId);
        }
    }
    if(blockingNations.length == 0) {
        log.info(`No blocking players for ${game.name}`);
        return [];
    }
    blockingNations.sort((a, b) => a - b);
    return blockingNations;
}

function pingBlockingPlayers(game) {
    game.getGameLobby(channel => { 
        util.getStaleNations(game, (err, staleNations) => {
            if(game.state.notifiedBlockers){
                log.info(`Already notified ${game.name}`);
                return;
            }
            let blockingNations = getBlockingNations(game, staleNations);

            if(blockingNations.length == 0) {
                log.info(`No blocking players for ${game.name}`);
                return;
            }

            let playerIDs = blockingNations.map(game.getPlayerForNation);
            let ping = playerIDs.map(id => `<@&${id}>`).join(' ');

            let hoursTillHost = Math.floor( (game.state.nextTurnStartTime.getSecondsFromNow() / 60 ) / 60);

            game.state.notifiedBlockers = true;
            channel.send(`${ping}\nNext turn starts in ${hoursTillHost} hours!`);
            saveGame(game);
        });
    });
}

function handleStreamLines(outStream, handler){
    const emitter = new EventEmitter.EventEmitter();

    let buffer = "";
    let lastEmit : Object[] = [];

    outStream
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
        log.debug(`${data}`);
        if(!lastEmit.includes(data)){
            lastEmit.unshift(data);
            lastEmit = lastEmit.slice(0, 3);
            handler(data);
        }
    });
}

function hostGame(game){
    log.info(`hosting: ${game.name}`);
    log.debug(`hosting right version? ${games[game.name] === game}`);
    if(!game.settings.server.port){
        let port = _.findKey(ports, p => p === null);
        if(port){
            log.info(`Assigned port: ${port} to game: ${game.name}`);
            game.settings.server.port = port;
            game.save();
        }else{
            throw `Failed to host! No available ports! Game: ${game.name}`;
        }
    }

    if(ports[game.settings.server.port] !== null){
        if(ports[game.settings.server.port] === game){
            log.warn(`Game seems already hosted. Game: ${game.name}, Port: ${game.settings.server.port}`);
        }else if(ports[game.settings.server.port]){
            throw `A game is already hosted on port! Other Game: ${ports[game.settings.server.port].name}, Port: ${game.settings.server.port}`;
        }else{
            throw `Port is not available! Port: ${game.settings.server.port}`;
        }
    }

    const args = getLaunchArgs(game);
    log.info(`Spawning Host: ${process.env.DOMINION_EXEC_PATH } ${args}`)
    const child = spawn(`${process.env.DOMINION_EXEC_PATH}`, args);

    child.stdout.setEncoding('utf-8');
    handleStreamLines(child.stdout, (data) => log.info(`[${game.name}] ${data}`));

    child.stderr.setEncoding('utf-8');
    handleStreamLines(child.stderr, (data) => log.error(`[${game.name}] ${data}`));
    
    ports[game.settings.server.port] = game;

    child.on('exit', (code, sig) => {
        delete game.getProcess;
        if(ports[game.settings.server.port] === game){
            ports[game.settings.server.port] = null;
        }
    });
    log.debug(`binding process on ${game.name} to ${child} ${child.pid}`);
    game.getProcess = () => child;
    game.canary = child.pid;
}

function stopGame(game){
    log.info(`stopping ${game.name} ${game.canary}`)
    if(game.getProcess){
        game.getProcess().kill();
        game.getProcess = null;
    }
    if(ports[game.settings.server.port] === game){
        ports[game.settings.server.port] = null;
    }
}

function unloadGame(game){
    log.info(`unloading: ${game.name} ${game.canary}`);
    stopGame(game);
    if(games[game.name] === game){
        delete games[game.name];
    }
}

function deleteGame(game) {
    log.info(`Deleting ${game.name} ${game.canary}`);
    let childProcess = game.getProcess ? game.getProcess() : null;
    unloadGame(game);
    game.getGuild(guild => {
        if(game.discord.playerRoleId){
            guild.roles.fetch(game.discord.playerRoleId)
                .then(r => r.delete())
                .catch(log.error);
        }

        if(game.discord.channelId){
            guild.client.channels.fetch(game.discord.channelId)
                .then(c => c.delete())
                .catch(log.error);
        }

        if(game.discord.gameLobbyChannelId){
            guild.client.channels.fetch(game.discord.gameLobbyChannelId)
                .then(c => c.delete())
                .catch(log.error);
        }
    });
    let cleanup = () => {
        util.deleteGameSave(game);
        util.deleteJSON(game.name);
    };
    if(!childProcess){
        //wait for the game to stop
        setTimeout(cleanup, 2000);
    }else{
        childProcess.on('exit', cleanup);
    }
}

function loadGame(name, bot, cb){
    util.loadJSON(name, (data, err) => {
        log.info('Wrapping game');
        if(err) throw `Error ${err}`;
        cb(wrapGame(data, bot));
    });
}

function saveGame(game){
    util.saveJSON(game.name, game);
}

function wrapGame(game, bot){
    if(game.state.nextTurnStartTime){
        game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime);
    }

    if(!game.settings.setup.mods){
        game.settings.setup.mods = [];
    }

    let channel = null;
    game.getChannel = (cb) => {
        if(channel === null){
           bot.channels.fetch(game.discord.channelId, true)
           .then(c => {
                channel = c;
                cb(c);
            })
            .catch(log.error);
        }else{
            cb(channel);
        }
    }

    let gameLobby = null;
    game.getGameLobby = (cb) => {
        if(gameLobby === null){
           bot.channels.fetch(game.discord.gameLobbyChannelId, true)
           .then(c => {
                gameLobby = c;
                cb(c);
            })
            .catch(log.error);
        }else{
            cb(gameLobby);
        }
    }

    let guild = null;
    game.getGuild = (cb) => {
        if(guild === null){
            game.getChannel(ch => {
                guild = ch.guild;
                cb(guild);
            });
        }else{
            cb(guild);
        }
    }
    game.save = () => {saveGame(game)};
    game.getPlayerForNation = (nationId) => {
        for(let userID in game.discord.players ){
            if(game.discord.players[userID] == nationId)
                return userID;
        }
        return null;
    };
    game.getDisplayName = (nationId) => {
        let playerId = game.getPlayerForNation(nationId);
        if(playerId){
            let player = bot.users.cache.get(playerId);
            if(!player){
                bot.users.fetch(playerId, true);
                return 'Loading...';
            }else{
                return player.username;
            }
        }
        return '-';
    };
    
    for(let userID in game.discord.players ){
        bot.users.fetch(userID, true);
    }

    games[game.name] = game;

    return game;
}

function getLaunchArgs(config){
    const server = config.settings.server;
    const turns = config.settings.turns;
    const setup = config.settings.setup;

    let args : string[] = [];
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
    if(!turns.quickHost) args.push("--noquickhost");
    if(turns.maxTurnTime) {
        args.push("--hours");
        args.push(turns.maxTurnTime);
    }

    //new game settings
    args.push("--noclientstart");
    args.push("--masterpass");
    args.push(setup.masterPass);
    args.push("--thrones", setup.thrones[0], setup.thrones[1], setup.thrones[2]);
    if(setup.victoryPoints){
        args.push("--requiredap");
        args.push(setup.victoryPoints);
    }
    if(setup.cataclysm) {
        args.push("--cataclysm");
        args.push(setup.cataclysm);
    }
    if(CONSTANTS.SIMPLE_RAND_MAP[setup.map]){
        args = args.concat(CONSTANTS.SIMPLE_RAND_MAP[setup.map]);
    }else{
        args.push("--mapfile");
        args.push(setup.map);
    }
    if(setup.mods && setup.mods.length > 0){
        setup.mods.forEach(mod => args.push("--enablemod", mod));
    }else{
        args.push("--nomods");
    }
    args = args.concat(CONSTANTS.ERA[setup.era]);
    args = args.concat(CONSTANTS.EVENTS[setup.eventRarity]);

    args.push(CONSTANTS.STORY_EVENTS[setup.storyEvents]);
    for(let k in setup.slots){
        args.push(CONSTANTS.SLOTS[setup.slots[k]])
        args.push(k);
    }
    args.push(config.name);

    return args;
}

export = {
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