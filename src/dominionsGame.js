
const _ = require("lodash");
const fs = require("fs");
const config = require("../res/config.json");
const CONSTANTS = require("./constants.js");
const util = require('./util.js');
const spawn = require('child_process').spawn;

const ports = {};
_.forEach(config.PORTS, p => ports[p] = null);

const games = {};

function killGames(){
    _.keys(ports, (key) => {
        if(ports[key].getProcess){
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
    console.info(`Created ${game.name}. Master Pass: ${game.settings.setup.masterPass}`);
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
                        channel.messages.delete(game.discord.pingMessageId);
                    }
                    game.discord.pingMessageId = m.id;
                    cb(m);
                });
        });
    }
}

function pingStalePlayers(game, msg, cb){
    game.getChannel(channel => { 
        //ping players who are stale
    });
}

function hostGame(game){
    if(!game.settings.server.port){
        let port = _.findKey(ports, p => p === null);
        if(port){
            console.info(`Assigned port: ${port} to game: ${game.name}`);
            game.settings.server.port = port;
            game.save();
        }else{
            throw `Failed to host! No available ports! Game: ${game.name}`;
        }
    }

    if(ports[game.settings.server.port] !== null){
        if(ports[game.settings.server.port] === game){
            console.warn(`Game seems already hosted. Game: ${game.name}, Port: ${game.settings.server.port}`);
        }else if(ports[game.settings.server.port]){
            throw `A game is already hosted on port! Other Game: ${ports[game.settings.server.port].name}, Port: ${game.settings.server.port}`;
        }else{
            throw `Port is not available! Port: ${game.settings.server.port}`;
        }
    }

    const args = getLaunchArgs(game);
    console.info('Spawning Host: ' + config.DOMINION_EXEC_PATH + " " + args)
    const process = spawn(config.DOMINION_EXEC_PATH, args, {stdio: 'inherit'});

    ports[game.settings.server.port] = game;

    process.on('close', (code, sig) => {
        delete game.getProcess;
        if(ports[game.settings.server.port] === game){
            ports[game.settings.server.port] = null;
        }
    });

    game.getProcess = () => process;
}

function stopGame(game){
    if(game.getProcess){
        game.getProcess().kill();
        delete game.getProcess;
    }
    if(ports[game.settings.server.port] === game){
        ports[game.settings.server.port] = null;
    }
}

function unloadGame(game){
    stopGame(game);
    if(games[game.name] === game){
        delete games[game.name];
    }
}

function deleteGame(game) {
    unloadGame(game);
    //wait 2 seconds for the game to stop
    setTimeout(() => {
        game.getGuild(guild => {
            if(game.discord.playerRoleId){
                guild.roles.fetch(game.discord.playerRoleId)
                    .then(r => r.delete())
                    .catch(console.error);
            }

            if(game.discord.channelId){
                guild.client.channels.fetch(game.discord.channelId)
                    .then(c => c.delete())
                    .catch(console.error);
            }

            if(game.discord.gameLobbyChannelId){
                guild.client.channels.fetch(game.discord.gameLobbyChannelId)
                    .then(c => c.delete())
                    .catch(console.error);
            }
        });
        util.deleteGameSave(game);
        util.deleteJSON(game.name);
    }, 2000);
}

function loadGame(name, bot, cb){
    util.loadJSON(name, (data, err) => {
        console.info('Wrapping game');
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
           bot.channels.fetch(game.discord.channelId, true).then(c => {
                channel = c;
                cb(c);
            });
        }else{
            cb(channel);
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
        for( userID in game.discord.players ){
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
    
    for( userID in game.discord.players ){
        bot.users.fetch(userID, true);
    }

    games[game.name] = game;

    return game;
}

function getLaunchArgs(config){
    const server = config.settings.server;
    const turns = config.settings.turns;
    const setup = config.settings.setup;

    let args = [];
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
    if(turns.maxHoldups) {
        args.push("--maxholdups")
        args.push(turns.maxHoldups);
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
    for(k in setup.slots){
        args.push(CONSTANTS.SLOTS[setup.slots[k]])
        args.push(k);
    }
    args.push(config.name);

    return args;
}

module.exports = {
    create,
    getLaunchArgs,
    loadGame,
    stopGame,
    saveGame,
    hostGame,
    pingPlayers,
    deleteGame,
    getGames
};