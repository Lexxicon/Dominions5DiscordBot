const log = require("log4js").getLogger();

import * as constants from './constants.js';
import { deleteGame, Game, getGames, hostGame, saveGame, stopGame } from "./dominionsGame.js";
import util from './util.js';

const races = require("../res/races.json");



function joinUser(msg, game: Game, nationID){
    let roleID = game.discord.playerRoleId;
    if(roleID){
        msg.guild.roles.fetch(roleID)
            .then(role => {
                msg.member.roles.add(role);
            });
    }

    if(nationID){
        if(game.discord.players[msg.member.id]){
            msg.channel.send(`You've already joined!: ${races[game.settings.setup.era][game.discord.players[msg.member.id]]}`);
        }else if(races[game.settings.setup.era][nationID]) {
            for(let otherPlayer in game.discord.players){
                if(game.discord.players[otherPlayer] == nationID){
                    msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                    return -1;
                }
            }
            game.discord.players[msg.member.id] = nationID;
            setTimeout(() => {
                if(game.update) game.update();
                msg.channel.send(`Joined ${game.getDisplayName(nationID)} as ${races[game.settings.setup.era][nationID]}`);
            }, 1000);
            game.save();
        }else {
            msg.channel.send(`Invalid race for given era! era: ${game.settings.setup.era}, nationID: ${nationID}`)
            return -1;
        }
    }

    return 0;
}

function switchUser(msg, game: Game, nationID){
    if(!game.discord.players[msg.member.id]){
        msg.channel.send(`You haven't joined yet!`);
        return -1;
    }else if(races[game.settings.setup.era][nationID]) {
        for(let otherPlayer in game.discord.players){
            if(msg.member.id !== otherPlayer && game.discord.players[otherPlayer] == nationID){
                msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                return -1;
            }
        }
        game.discord.players[msg.member.id] = nationID;
        setTimeout(() => {
            if(game.update) game.update();
            msg.channel.send(`Joined ${game.getDisplayName(nationID)} as ${races[game.settings.setup.era][nationID]}`);
        }, 1000);
        game.save();
    }
    return 0;
}

function delayTurn(msg, game: Game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }

    let seconds = util.getSeconds(arg);

    game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime.getTime() + (seconds * 1000));
    log.info(`Next turn for ${game.name} scheduled at ${game.state.nextTurnStartTime}`);
    util.domcmd.startGame(game, game.state.nextTurnStartTime.getSecondsFromNow());

    msg.channel.send(`Turn delayed until ${game.state.nextTurnStartTime}`);

    return 0;
}

function deleteGameCmd(msg, game: Game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }
    
    deleteGame(game);
}

function startGame(msg, game: Game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }
    let playerCount = game.playerCount;
    let provPerPlayer = constants.SIMPLE_RAND_MAP[game.settings.setup.map][1];
    log.info(`playerCount: ${playerCount}, perPlayer ${provPerPlayer}`)
    let provinces = playerCount * provPerPlayer;
    log.info("provinces " + provinces);
    let VP =  Math.ceil(Math.log(provinces) * 1.3) + Math.floor(provinces / 75);
    game.settings.setup.victoryPoints = VP;
    log.info("VP " + VP)
    game.settings.setup.thrones = [];
    game.settings.setup.thrones[0] = Math.ceil(VP * 0.60);
    game.settings.setup.thrones[1] = Math.ceil(VP * 0.35);
    game.settings.setup.thrones[2] = Math.ceil(VP * 0.15);
    log.info(game.settings.setup.thrones);
    saveGame(game);
    log.info("Killing")
    let childProcess = game.getProcess ? game.getProcess() : null;
    stopGame(game);
    let start = () => {
        log.info("Spawning")
        hostGame(game);
        util.domcmd.startGame({name: game.name});
    };

    if(!childProcess){
        //wait for game to close
        setTimeout(start, 10000);
    }else{
        childProcess.on('exit', start);
    }

    return 0;
}

function forceTurn(msg, game: Game, arg: string){
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }
    log.debug(`forcing turn with arg ${arg}`)
    let time = util.getSeconds(arg || '15s');
    game.state.nextTurnStartTime = new Date(Date.now() + time * 1000)
    util.domcmd.startGame({name: game.name}, time);
    msg.channel.send(`Ending turn in ${time} seconds!`);
    return 0;
}

function restartGame(msg, game: Game, arg){
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }
    log.info(`Killing ${game.name} ${game.canary}`);
    let gameProcess = game.getProcess ? game.getProcess() : null;
    stopGame(game);
    let host = () => {
        log.info("Spawning")
        hostGame(game);
    };
    if(!gameProcess){
        log.debug("Process not found. Waiting instead");
        //wait for game to close
        setTimeout(host, 10000);
    }else{
        log.debug("Hooking exit");
        gameProcess.on('exit', () => setTimeout(host, 100));
    }
    return 0;
}

function changeGameSettings(msg, game: Game, arg){
    if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
        return -1;
    }

    let args = arg ? arg.split(' ') : [];
    if(args.length > 0){
        switch(args[0]) {
            case 'listMods':
                util.getAvailableMods(f => msg.channel.send(`Available Mods\n${f.join('\n')}`));
            return 0;

            case 'addMod':
                if(game.state.turn != -1){
                    return -1;
                }
                util.getAvailableMods(f => {
                    if( f.includes(args[1]) && !game.settings.setup.mods.includes(args[1]))  {
                        log.info("added mod!")
                        game.settings.setup.mods.push(args[1]);
                        saveGame(game);
                        msg.channel.send(`Added Mod: ${args[1]}`);
                    }
                });
            return 0;

            case 'listAddedMods':
                msg.channel.send(`Mods\n${game.settings.setup.mods.join('\n')}`);
                game.settings.setup.mods.forEach(element => {
                    log.info(element);
                });
            return 0;

            case 'set':{
                let settingsPath = args[1].split('.');
                log.debug(`split path ${settingsPath}`);
                let settings = game;
                for(let i = 0; i < settingsPath.length - 1; i++){
                    settings = settings[settingsPath[i]];
                }
                log.debug(`Result settings: ${settings}`);
                settings[settingsPath[settingsPath.length - 1]] = args[2];
                saveGame(game);
                return 0;
            }
            case 'get':{
                let settingsPath = args[1].split('.');
                log.debug(`split path ${settingsPath}`);
                let settings = game;
                let lastValue = '';
                for(let p of settingsPath){
                    lastValue = p;
                    settings = settings[p];
                }
                msg.channel.send(`Value of ${lastValue}=${settings}`);
                return 0;
            }
            default: 
                return -1;
        }
    }

}

function resign(msg, game: Game, arg) {
    let roleID = game.discord.playerRoleId;
    if(roleID){
        msg.guild.roles.fetch(roleID)
            .then(role => {
                msg.member.roles.remove(role);
            })
            .catch(log.error);
    }
    if(game.discord.players[msg.member.id]){
        let nationID = game.discord.players[msg.member.id];
        let displayName = `${game.getDisplayName(nationID)}`;
        delete game.discord.players[msg.member.id];
        setTimeout(() => {
            if(game.update) game.update();
            msg.channel.send(`Resigned ${displayName} from ${races[game.settings.setup.era][nationID]}`);
        }, 1000);
        game.save();
    }
    return 0;
}

function handleCommand(msg){
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);

    let games = getGames();
    for(let gameKey in games){
        let game = games[gameKey];

        if(msg.channel.id != game.discord.gameLobbyChannelId){
            continue;
        }

        switch(command){
            case 'join':
            case 'claim':
                return joinUser(msg, game, arg);
            case 'switch':
                return switchUser(msg, game, arg);
            case 'delete':
                return deleteGameCmd(msg, game, arg);
            case 'delay':
                return delayTurn(msg, game, arg);
            case 'start':
                return startGame(msg, game, arg);
            case 'forceTurn':
                return forceTurn(msg, game, arg);
            case 'config':
                return changeGameSettings(msg, game, arg);
            case 'stales':
                util.getStaleNations(game, (er, nation) => msg.channel.send(`Stale Nations: ${nation}`));
                return 0;
            case 'resign':
                return resign(msg, game, arg);
            case 'backup':
                if(!msg.member.roles.cache.find(r => r.name === `${process.env.DEFAULT_GAME_MASTER}`)){
                    return -1;
                }
                util.backupGame(game.name);
                return 0;
            case 'restartGame':
                return restartGame(msg, game, arg);
            default: 
                return -1;
        }
    }
    return -1;
}

export = handleCommand;