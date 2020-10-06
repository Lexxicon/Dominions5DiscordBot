import * as constants from './Constants';
import Discord, { Constants, Message, Snowflake } from 'discord.js';
import { Game, getChannel, getPlayerDisplayName, getPlayerForNation, pingBlockingPlayers, pingPlayers, saveGame } from './DominionsGame';
import fs from 'fs';
import _ from 'lodash';
import dateFormat from 'dateformat';
import log4js from 'log4js';
import Util from './Util';
import AsciiTable from 'ascii-table';

const log = log4js.getLogger();
const STATUS_REGEX = /^Status for '(?<GAME_NAME>.*)'$/;
const TURN_REGEX = /turn (?<TURN>-?\d+), era (?<ERA>\d+), mods (?<MODS>\d+), turnlimit (?<TURN_LIMIT>\d+)/;
const NATION_REGEX = /^Nation\t(?<NATION_ID>\d+)\t(?<PRETENDER_ID>\d+)\t(?<PLAYER_STATUS>\d)\t(?<AI_DIFFICULTY>\d)\t(?<TURN_STATE>\d)\t(?<STRING_ID>\w*)\t(?<NAME>[^\t]*)\t(?<TITLE>[^\t]*)/;

const nextAllowedUpdate: { [k : string]:number } = {};
const queuedUpdate: { [k : string]:NodeJS.Timeout} = {};

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
            display: string,
            short: string
        },
    }[] = [];
}

class PlayerStatus{
    nationId = 0;
    pretenderId = 0;
    stringId = "";
    aiDifficulty = 0;
    playerStatus = {
        id: 0,
        canBlock: true,
        display: ""
    };
    name = "";
    title = "";
    turnState = {
        id: 0,
        ready: false,
        display: "",
        short: ""
    };
}

function parseLines(lines: string[]) : GameState{

    const gameState = new GameState();

    for(let line of lines){
        let res: RegExpMatchArray | null = null;
        if((res = line.match(NATION_REGEX)) && res.groups){
            const groups = res.groups;
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
        }else if((res = line.match(STATUS_REGEX)) && res.groups){
            gameState.name = res.groups.GAME_NAME;
        }else if((res = line.match(TURN_REGEX)) && res.groups){
            const groups = res.groups;
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

async function createEmbeddedGameState(game: Game, gameState: GameState, staleNations: Snowflake[]){
    let activeNames: string[] = [];
    let activePlayers: string[] = [];
    let activeState: string[] = [];
    let staleMap = {};

    for(let nation of staleNations){
        staleMap[nation] = nation;
    }

    let activePlayerCount = 0;

    const addRecord = async (s: PlayerStatus) => {
        if(gameState.turnState.turn >= 0 && s.playerStatus.id == 0){
            return;
        }
        activeNames.push(`${s.nationId} ${s.name}`);

        let playerName = "";

        if(s.aiDifficulty > 0){
            playerName = constants.AI_DIFFICULTY[s.aiDifficulty];
        }else{
            playerName = await getPlayerDisplayName(game, `${s.nationId}`);
            if(playerName == '-'){
                if(s.playerStatus.id != 0){
                }
                playerName = s.playerStatus.display;
            }
        }
        if(s.playerStatus.id < 0){ //AI
            playerName = `[${s.playerStatus.display}] ${playerName}`;
        }
        if(playerName != '-' && playerName != ''){
            activePlayerCount++;
        }
        activePlayers.push(playerName);
        let state = "-";

        if(s.turnState.id == 9){
            let uploaded = s.playerStatus.id != 0;
            let claimed = getPlayerForNation(game, `${s.nationId}`) != null;
            if(uploaded && claimed){
                state = constants.EMOJI[":checkBox:"];
            }else if(claimed && !uploaded) {
                state = constants.EMOJI[":save:"];
            }else if(!claimed && uploaded) {
                state = constants.EMOJI[":spy:"];
            }else{
                state = '';
            }
        }else {
            if(s.playerStatus.id == 1){
                if(game.state.turn > 2 && s.stringId && staleMap[s.stringId] && s.turnState.id == 0){
                    state = constants.EMOJI[":sleeping:"];
                }else{
                    state = s.turnState.short;
                }
            }else{
                state = '-';
            }
        }
        activeState.push(state);
    }

    if(gameState.turnState.turn >= 0){
        for(let status of gameState.playerStatus){
            if(status.playerStatus.canBlock){
                await addRecord(status);
            }
        }
        for(let status of gameState.playerStatus){
            if(!status.playerStatus.canBlock){
                await addRecord(status);
            }
        }
    }else{
        for(let status of gameState.playerStatus){
            await addRecord(status);
        }
    }
    
    game.playerCount = activePlayerCount;

    let desc: string[] = [];

    desc.push(`Hosted at: ${process.env.HOST_URL}`);
    desc.push(`Port: ${game.settings.server.port}\n`);

    let secondsTillHost = game.state.nextTurnStartTime.getSecondsFromNow();
    log.info(`Seconds till host ${secondsTillHost}`);

    if(gameState.turnState.turn < 0){
        desc.push("Lobby");
    } else{
        if(gameState.turnState.turnLimit){
            desc.push(`Turn: ${gameState.turnState.turn}/${gameState.turnState.turnLimit}`);
        }else{
            desc.push(`Turn: ${gameState.turnState.turn}`);
        }
        if(game.state.paused){
            desc.push(`Paused`);
        }else if(game.state.nextTurnStartTime){
            desc.push(`Auto Host at: ${dateFormat(game.state.nextTurnStartTime, 'yyyy-mm-dd HH:MM')}`);
            
            desc.push(`Next turn starts in ${Util.getDisplayTime(secondsTillHost)}!`);
        }
    }

    let table = new AsciiTable(game.name);
    table.removeBorder();
    table.setHeading('Empire', 'Player', 'Turn');
    for(let i = 0; i < activeNames.length; i++){
        table.addRow(activeNames[i], activePlayers[i], activeState[i]);
    }

    return '```'+(desc.join('\n'))+'\n\n'+table.toString()+'```' as string;
}

async function read(path: string){
    log.info('reading ' + path)
    try{
        let data = await fs.promises.readFile(path, 'utf8');
        return data.split('\n');
    }catch(err){
        log.error(err);
        return [];
    }
}

function getStatusFilePath(game:Game){
    return `${process.env.DOM5_CONF}/savedgames/${game.name}/statusdump.txt`;
}

async function updateGameStatus(game: Game){    
    let updateTime = new Date().addSeconds(15);
    if(nextAllowedUpdate[game.name] && nextAllowedUpdate[game.name] > new Date().getTime()){
        log.debug(`Reducing spam for ${game.name}`);
        if(!queuedUpdate[game.name]){
            log.info(`Scheduling update for ${game.name} in ${updateTime.getSecondsFromNow()}s`);
            let updateTask = setTimeout(()=> updateGameStatus(game), (updateTime.getSecondsFromNow()+1) * 1000);
            nextAllowedUpdate[game.name] = updateTime.getTime();
            queuedUpdate[game.name] = updateTask;
        }
        return;
    }else{
        nextAllowedUpdate[game.name] = updateTime.getTime();
    }
    delete queuedUpdate[game.name];
    log.info(`updating ${game.name}`);
    let lines = await read(getStatusFilePath(game));
    log.debug(`fetching stale nations`);
    let staleNations = await Util.getStaleNations(game);
    log.debug(`parsing turn state`);
    let currentTurnState = parseLines(lines);
    if(game.state.turn != currentTurnState.turnState.turn && currentTurnState.turnState.turn > 0){
        log.debug(`processing new turn`);
        game.state.turn = currentTurnState.turnState.turn;
        game.state.notifiedBlockers = false;
        game.state.nextTurnStartTime = new Date().addMinutes(game.settings.turns.maxTurnTimeMinutes);
        await pingPlayers(game, `Start of turn ${game.state.turn}`);
        await saveGame(game);
        await Util.backupGame(game.name);
    }
    log.debug(`building embed`);
    let embed = await createEmbeddedGameState(game, currentTurnState, staleNations);
    let msgID = game.discord.turnStateMessageId;
    let msg: undefined | Message;
    log.debug(`fetching channel`);
    let channel = await getChannel(game);
    if(channel){
        try{
            if(msgID){
                log.debug(`fetching message`);
                msg = await channel.messages.fetch(msgID);
                msg?.edit(embed);
            }
        }catch(err){
            log.error(`Error fetching message for ${game.name}, ${err}`);
        }
        if(msg == null || msg.deleted){
            log.debug(`sending new message`);
            msg = await channel.send(embed);
            msg.pin();
            game.discord.turnStateMessageId = msg.id;
        }
    }
    game.playerStatus = currentTurnState.playerStatus;

    let blockPingTime = new Date(game.state.nextTurnStartTime).addMinutes(-Math.ceil(game.settings.turns.maxTurnTimeMinutes / 4));
    log.debug(`Stale ping at ${blockPingTime}`);
    if(blockPingTime.getTime() < new Date().getTime() && game.state.turn > 0 && !game.state.paused){
        await pingBlockingPlayers(game);
    }else{
        game.state.notifiedBlockers = false;
    }

    await saveGame(game);

    // if(staleNations && staleNations.length > 0 && domGame.getBlockingNations(game, staleNations).length == 0 ){
    //     log.info(`Skipping stale players! Game: ${game.name}, Nations: ${staleNations}`);
    //     util.domcmd.startGame(game);
    // }
}

async function startWatches(game: Game) {
    log.info(`Starting watches on ${game.name}`)
    const filePath = getStatusFilePath(game);

    if(!game.discord.turnStateMessageId){
        log.info(`Preping turn state message`);
        let lines = await read(filePath);
        let staleNations = await Util.getStaleNations(game);
        const embeddedMessage = await createEmbeddedGameState(game, parseLines(lines), staleNations);
        let channel = await getChannel(game);
        if(channel && !game.discord.turnStateMessageId){
            let msg = await channel.send(embeddedMessage);
            msg.pin();
            game.discord.turnStateMessageId = msg.id;
            saveGame(game);
        }
    }
    log.info(`Fetching channel for ${game.name}`);
    let channel = await getChannel(game);
    if(channel != null && game.discord.turnStateMessageId){
        log.info(`Setting up watch for ${game.name}`);
        fs.watch(getStatusFilePath(game), 'utf8', () => updateGameStatus(game).catch(e => log.error(e)));
    }
}

export {
    PlayerStatus,
    parseLines,
    createEmbeddedGameState,
    startWatches,
    updateGameStatus
};
