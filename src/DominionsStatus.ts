import AsciiTable from 'ascii-table';
import dateFormat from 'dateformat';
import { Message, Snowflake } from 'discord.js';
import fs, { watch } from 'fs';
import log4js from 'log4js';
import { getDiscordBot } from '.';
import * as constants from './Constants';
import { Game, getChannel, getPlayerDisplayName, getPlayerForNation, pingBlockingPlayers, pingPlayers, saveGame } from './DominionsGame';
import Util from './Util';

const log = log4js.getLogger();
const STATUS_REGEX = /^Status for '(?<GAME_NAME>.*)'$/;
const TURN_REGEX = /turn (?<TURN>-?\d+), era (?<ERA>\d+), mods (?<MODS>\d+), turnlimit (?<TURN_LIMIT>\d+)/;
const NATION_REGEX = /^Nation\t(?<NATION_ID>\d+)\t(?<PRETENDER_ID>\d+)\t(?<PLAYER_STATUS>\d)\t(?<AI_DIFFICULTY>\d)\t(?<TURN_STATE>\d)\t(?<STRING_ID>\w*)\t(?<NAME>[^\t]*)\t(?<TITLE>[^\t]*)/;

const nextAllowedUpdate: { [k : string]:number } = {};
const queuedUpdate: { [k : string]:NodeJS.Timeout} = {};

const watches: Record<string, fs.FSWatcher> = {};

class GameState {
    name = "";
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

    for(const line of lines){
        let res: RegExpMatchArray | null = null;
        if((res = line.match(NATION_REGEX)) && res.groups){
            const groups = res.groups;
            gameState.playerStatus[Number(groups.NATION_ID)]={
                nationId: Number(groups.NATION_ID),
                pretenderId: Number(groups.PRETENDER_ID),
                stringId: groups.STRING_ID,
                aiDifficulty: Number(groups.AI_DIFFICULTY),
                playerStatus: constants.PLAYER_STATUS[groups.PLAYER_STATUS],
                name: groups.NAME,
                title: groups.TITLE,
                turnState: constants.TURN_STATE[groups.TURN_STATE],
            };
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

    return gameState;
}

async function createEmbeddedGameState(game: Game, gameState: GameState, staleNations: Snowflake[]){
    const activeNames: string[] = [];
    const activePlayers: string[] = [];
    const activeState: string[] = [];
    const staleMap = {};

    for(const nation of staleNations){
        staleMap[nation] = nation;
    }

    let activePlayerCount = 0;

    const addRecord = async (s: PlayerStatus) => {
        if(gameState.turnState.turn >= 0 && s.playerStatus.id == 0){
            return;
        }
        activeNames.push(`${s.name}`);

        let playerName = "";

        if(s.aiDifficulty > 0){
            playerName = constants.AI_DIFFICULTY[s.aiDifficulty];
        }else{
            playerName = await getPlayerDisplayName(game, `${s.nationId}`);
            if(playerName == '-'){
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
            const uploaded = s.playerStatus.id != 0;
            const claimed = getPlayerForNation(game, `${s.nationId}`) != null;
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
    };

    if(gameState.turnState.turn >= 0){
        for(const status of gameState.playerStatus){
            if(status && status.playerStatus.canBlock){
                await addRecord(status);
            }
        }
        for(const status of gameState.playerStatus){
            if(status && !status.playerStatus.canBlock){
                await addRecord(status);
            }
        }
    }else{
        for(const status of gameState.playerStatus){
            if(status){
                await addRecord(status);
            }
        }
    }
    
    game.playerCount = activePlayerCount;

    const desc: string[] = [];

    desc.push(`Hosted at: ${process.env.HOST_URL}`);
    desc.push(`Port: ${game.settings.server.port}\n`);

    if(game.settings.setup.mods.length > 0){
        desc.push(`Mods:\n${game.settings.setup.mods.join('\n')}\n`);
    }

    const secondsTillHost = game.state.nextTurnStartTime.getSecondsFromNow();
    log.info(`Seconds till host ${secondsTillHost}`);

    if(gameState.turnState.turn < 0){
        desc.push(`Lobby`);
        const channel = await getChannel(game);
        if(channel && game.discord.playerRoleId){
            const role = await channel.guild.roles.fetch(game.discord.playerRoleId);
            if(role){
                log.info(`found ${role.name} with ${role.members.size} memebers`);
                desc.push(`Players: ${role.members.size}`);
            }else{
                log.info(`Failed to find role`);
            }
        }
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

    const table = new AsciiTable(game.name);
    table.removeBorder();
    table.setHeading('Empire', 'Player', 'Turn');
    for(let i = 0; i < activeNames.length; i++){
        table.addRow(activeNames[i], activePlayers[i], activeState[i]);
    }

    return '```'+(desc.join('\n'))+'\n\n'+table.toString()+'```' as string;
}

async function read(path: string){
    log.info('reading ' + path);
    try{
        const data = await fs.promises.readFile(path, 'utf8');
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
    const updateTime = new Date().addSeconds(5);
    if(nextAllowedUpdate[game.name] && nextAllowedUpdate[game.name] > new Date().getTime()){
        log.debug(`Reducing spam for ${game.name}`);
        if(!queuedUpdate[game.name]){
            log.info(`Scheduling update for ${game.name} in ${updateTime.getSecondsFromNow()}s`);
            const updateTask = setTimeout(()=> updateGameStatus(game).catch(er => log.error(`Update error: ${er}`)), (updateTime.getSecondsFromNow()+1) * 1000);
            nextAllowedUpdate[game.name] = updateTime.getTime();
            queuedUpdate[game.name] = updateTask;
        }
        return;
    }else{
        nextAllowedUpdate[game.name] = updateTime.getTime();
    }
    delete queuedUpdate[game.name];
    log.info(`updating ${game.name}`);
    const lines = await read(getStatusFilePath(game));
    log.debug(`fetching stale nations`);
    const staleNations = await Util.getStaleNations(game);
    log.debug(`parsing turn state`);
    const currentTurnState = parseLines(lines);
    if(game.state.turn != currentTurnState.turnState.turn && currentTurnState.turnState.turn > 0){
        log.debug(`processing new turn`);
        game.state.turn = currentTurnState.turnState.turn;
        game.state.notifiedBlockers = false;
        game.state.nextTurnStartTime = new Date().addMinutes(game.settings.turns.maxTurnTimeMinutes);
        await pingPlayers(game, `Start of turn ${game.state.turn}`);
        const channel = await getChannel(game);
        await channel?.send(`Tip of the turn: ${Util.getRandomTip()}`);
        await saveGame(game);
        await Util.backupGame(game.name);
    }
    log.debug(`building embed`);
    const embed = await createEmbeddedGameState(game, currentTurnState, staleNations);
    const msgID = game.discord.turnStateMessageId;
    let msg: undefined | Message;
    try{
        log.debug(`fetching channel`);
        const channel = await getChannel(game);
        if(channel){
            try{
                if(msgID){
                    log.debug(`fetching message`);
                    msg = await channel.messages.fetch(msgID);
                    await msg?.edit(embed);
                }
            }catch(err){
                log.error(`Error fetching message for ${game.name}, ${err}`);
            }
            if(msg == null || msg.deleted){
                log.debug(`sending new message`);
                msg = await channel.send(embed);
                await msg.pin();
                game.discord.turnStateMessageId = msg.id;
            }
        }else{
            log.warn(`Failed to fetch channel for ${game.name}`);
        }
    }catch(err){
        log.error(`Error fetching channel ${err}`);
    }
    game.playerStatus = currentTurnState.playerStatus;

    const blockPingTime = new Date(game.state.nextTurnStartTime).addMinutes(-Math.ceil(game.settings.turns.maxTurnTimeMinutes / 4));
    log.debug(`Stale ping at ${blockPingTime}`);
    if(blockPingTime.getTime() < new Date().getTime() && game.state.turn > 0 && !game.state.paused){
        await pingBlockingPlayers(game);
    }else{
        game.state.notifiedBlockers = false;
    }

    await saveGame(game);
}

async function startWatches(game: Game) {
    log.info(`Starting watches on ${game.name}`);
    const filePath = getStatusFilePath(game);

    if(!game.discord.turnStateMessageId){
        log.info(`Preping turn state message`);
        const lines = await read(filePath);
        const staleNations = await Util.getStaleNations(game);
        const embeddedMessage = await createEmbeddedGameState(game, parseLines(lines), staleNations);
        const channel = await getChannel(game);
        if(channel && !game.discord.turnStateMessageId){
            const msg = await channel.send(embeddedMessage);
            await msg.pin();
            game.discord.turnStateMessageId = msg.id;
            await saveGame(game);
        }
    }
    log.info(`Fetching channel for ${game.name}`);
    const channel = await getChannel(game);
    if(channel != null && game.discord.turnStateMessageId){
        log.info(`Setting up watch for ${game.name}`);
        const watcher = fs.watch(getStatusFilePath(game), 'utf8', () => updateGameStatus(game).catch(e => log.error(e)));
        watches[game.name] = watcher;
    }
}

function unwatch(game:Game){
    watches[game.name].close();
    delete watches[game.name];
}

export {
    PlayerStatus,
    parseLines,
    createEmbeddedGameState,
    startWatches,
    updateGameStatus,
    unwatch
};
