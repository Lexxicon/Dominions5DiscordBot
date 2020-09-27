const log = require("log4js").getLogger();

import Discord, { Message, Snowflake } from 'discord.js';
import fs from 'fs';
import _ from 'lodash';
import * as constants from './constants.js';
import { Game, pingBlockingPlayers, pingPlayers, saveGame } from './dominionsGame.js';
import util from './util.js';

const STATUS_REGEX = /^Status for '(?<GAME_NAME>.*)'$/;
const TURN_REGEX = /turn (?<TURN>-?\d+), era (?<ERA>\d+), mods (?<MODS>\d+), turnlimit (?<TURN_LIMIT>\d+)/;
const NATION_REGEX = /^Nation\t(?<NATION_ID>\d+)\t(?<PRETENDER_ID>\d+)\t(?<PLAYER_STATUS>\d)\t(?<AI_DIFFICULTY>\d)\t(?<TURN_STATE>\d)\t(?<STRING_ID>\w*)\t(?<NAME>[^\t]*)\t(?<TITLE>[^\t]*)/;

const blockingNotifications = {};

class GameState {
    name: string = "";
    turnState: {
        turn: number,
        era: string,
        mods: any,
        turnLimit: number
    } = {
        turn: -1,
        era: 'EARLY',
        mods: null,
        turnLimit: -1
    };
    playerStatus: {
        nationId: number,
        pretenderId: number,
        stringId: string,
        aiDifficulty: number,
        playerStatus: {
            id: number,
            canBlock: boolean,
            display: string
        },
        name: string,
        title: string,
        turnState: {
            id: number,
            ready: boolean,
            display: string
        },
    }[] = [];
}

function parseLines(lines) : GameState{

    const gameState = new GameState();

    for(let line of lines){
        if(NATION_REGEX.test(line)){
            const groups = line.match(NATION_REGEX).groups;
            gameState.playerStatus.push({
                nationId: Number(groups.NATION_ID),
                pretenderId: Number(groups.PRETENDER_ID),
                stringId: groups.STRING_ID,
                aiDifficulty: Number(groups.AI_DIFFICULTY),
                playerStatus: constants.PLAYER_STATUS[groups.PLAYER_STATUS],
                name: groups.NAME,
                title: groups.TITLE,
                turnState: constants.TURN_STATE[groups.TURN_STATE],
            });
        }else if(STATUS_REGEX.test(line)){
            gameState.name = line.match(STATUS_REGEX).groups.GAME_NAME;
        }else if(TURN_REGEX.test(line)){
            const groups = line.match(TURN_REGEX).groups;
            gameState.turnState = {
                turn: Number(groups.TURN),
                era: groups.ERA,
                mods: groups.MODS,
                turnLimit: Number(groups.TURN_LIMIT)
            };
        }
    }

    gameState.playerStatus = _.sortBy(gameState.playerStatus, o => o.nationId);

    return gameState;
}

function createEmbeddedGameState(game: Game, gameState: GameState, staleNations: Snowflake[]){
    const fields: {name: string, value: string, inline: boolean}[] = [];
    let activeNames: string[] = [];
    let activePlayers: string[] = [];
    let activeState: string[] = [];
    let staleMap = {};

    for(let nation of staleNations){
        staleMap[nation] = nation;
    }

    let activePlayerCount = 0;

    const addRecord = (s) => {
        if(gameState.turnState.turn >= 0 && s.playerStatus.id == 0){
            return;
        }
        activeNames.push(`[${s.nationId}] ${s.name}`);

        let playerName = "";

        if(s.aiDifficulty > 0){
            playerName = constants.AI_DIFFICULTY[s.aiDifficulty];
            activePlayerCount++;
        }else{
            playerName = game.getDisplayName(s.nationId);
            if(playerName == '-'){
                if(s.playerStatus.id != 0){
                    activePlayerCount++;
                }
                playerName = s.playerStatus.display;
            }
        }
        if(s.playerStatus.id < 0){
            playerName = `[${s.playerStatus.display}] ${playerName}`;
        }
        activePlayers.push(playerName);
        let state = "-";

        if(s.turnState.id == 9){
            let uploaded = s.playerStatus.id != 0;
            let claimed = game.getPlayerForNation(s.nationId) != null;
            if(uploaded && claimed){
                state = 'Ready';
            }else if(claimed && !uploaded) {
                state = 'Upload Pretender';
            }else if(!claimed && uploaded) {
                state = 'Missing Claim';
            }else{
                state = '-';
            }
        }else {
            if(s.playerStatus.id == 1){
                if(game.state.turn > 2 && s.stringId && staleMap[s.stringId] && s.turnState.id == 0){
                    state = "Stale";
                }else{
                    state = s.turnState.display;
                }
            }else{
                state = '-';
            }
        }
        activeState.push(state);
    }

    if(gameState.turnState.turn >= 0){
        _.filter(gameState.playerStatus, s => s.playerStatus.canBlock).forEach(addRecord);
        _.filter(gameState.playerStatus, s => !s.playerStatus.canBlock).forEach(addRecord);
    }else{
        _.forEach(gameState.playerStatus, addRecord);
    }
    game.playerCount = activePlayerCount;
    fields.push({
        name: 'Empire',
        value: _.join(activeNames, "\n"),
        inline: true
    });
    fields.push({
        name: 'Player',
        value: _.join(activePlayers, "\n"),
        inline: true
    });
    fields.push({
        name: 'Turn State',
        value: _.join(activeState, '\n'),
        inline: true
    });

    fields.forEach(v => {
        if(v.value.length == 0) v.value = '-';
    });

    let desc: string[] = [];

    desc.push(`Hosted at: ${process.env.HOST_URL}`);
    desc.push(`Port: ${game.settings.server.port}\n`);

    if(gameState.turnState.turn < 0){
        desc.push("Lobby");
    } else{
        if(gameState.turnState.turnLimit){
            desc.push(`Turn: ${gameState.turnState.turn}/${gameState.turnState.turnLimit}`);
        }else{
            desc.push(`Turn: ${gameState.turnState.turn}`);
        }
        if(game.state.nextTurnStartTime){
            desc.push(`Auto Host at: ${game.state.nextTurnStartTime}`);
            
            let hoursTillHost = Math.floor( (game.state.nextTurnStartTime.getSecondsFromNow() / 60 ) / 60);           
            desc.push(`Next turn starts in ${hoursTillHost} hours!`);
        }
    }

    const embeddedMessage = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Game State for: ${gameState.name}`)
        .setDescription(_.join(desc, '\n'))
        .addFields(
            fields
        );

    return embeddedMessage;
}

function read(path: string, cb){
    log.info('reading ' + path)
    fs.readFile(path, 'utf8', (err, data) => {
        if(err){
            log.warn(err);
        }else{
            cb(data.split('\n'));
        } 
    });
}

function bindUpdateGameStatus(msg: Message, filePath: string, game: Game){
    return () => {
        log.info(`updating ${game.name}`);
        read(filePath, (lines) => {
            util.getStaleNations(game, (err, staleNations) => {
                let currentTurnState = parseLines(lines);
                if(game.state.turn != currentTurnState.turnState.turn && currentTurnState.turnState.turn > 0){
                    if(blockingNotifications[game.name]){
                        clearTimeout(blockingNotifications[game.name]);
                        delete blockingNotifications[game.name];
                    }
                    
                    game.state.turn = currentTurnState.turnState.turn;
                    game.state.notifiedBlockers = false;
                    if(game.settings.turns.maxTurnTime){
                        game.state.nextTurnStartTime = new Date().addHours(game.settings.turns.maxTurnTime);
                    }else{
                        game.state.nextTurnStartTime = new Date().addMinutes(game.settings.turns.maxTurnTimeMinutes);
                    }
                    pingPlayers(game, `Start of turn ${game.state.turn}`,
                        (m) => {
                            saveGame(game);
                            setTimeout(() => util.backupGame(game.name), 10000);
                        });
                }
                msg.edit(createEmbeddedGameState(game, currentTurnState, staleNations));
                game.playerStatus = currentTurnState.playerStatus;
                saveGame(game);

                if(!blockingNotifications[game.name]){
                    let blockPingTime = new Date(game.state.nextTurnStartTime);
                    if(game.settings.turns.maxTurnTime){
                        blockPingTime.addHours(-Math.ceil(game.settings.turns.maxTurnTime / 4));
                    }else{
                        blockPingTime.addMinutes(-Math.ceil(game.settings.turns.maxTurnTimeMinutes / 4));
                    }
                    let timeTillPing = blockPingTime.getSecondsFromNow() * 1000;
                    log.info(`Scheduling ping for ${blockPingTime}`);
                    if(timeTillPing > 0){
                        blockingNotifications[game.name] = setTimeout(() => pingBlockingPlayers(game), timeTillPing);
                    }
                }

                // if(staleNations && staleNations.length > 0 && domGame.getBlockingNations(game, staleNations).length == 0 ){
                //     log.info(`Skipping stale players! Game: ${game.name}, Nations: ${staleNations}`);
                //     util.domcmd.startGame(game);
                // }
            })
        });
    }
}

function watchStatusFile(filePath: string, game: Game){
    log.info(`Setting up watch for ${game.name}`);
    game.getChannel(c => {
        c.messages.fetch(game.discord.turnStateMessageId)
            .then( msg =>{
                let update = bindUpdateGameStatus(msg, filePath, game);
                fs.watch(filePath, 'utf8', update);
                update();
                game.update = update;
            });
    });
}

function startWatches(game: Game) {
    log.info(`Starting watches on ${game.name}`)
    const filePath = `${process.env.DOMINION_SAVE_PATH}${game.name}/statusdump.txt`;
    if(!game.discord.turnStateMessageId){

        read(filePath, (lines) => {
            util.getStaleNations(game, (err, staleNations) => {
                const embeddedMessage = createEmbeddedGameState(game, parseLines(lines), staleNations);
                game.getChannel(c => {
                    if(!game.discord.turnStateMessageId){
                        c.send(embeddedMessage)
                            .then(msg => {
                                msg.pin();
                                game.discord.turnStateMessageId = msg.id;
                                saveGame(game);
                                watchStatusFile(filePath, game);
                            });
                    }
                });
                
            });
        });
    }else{
        watchStatusFile(filePath, game);
    }
}

export = {
    parseLines,
    createEmbeddedGameState,
    startWatches
}