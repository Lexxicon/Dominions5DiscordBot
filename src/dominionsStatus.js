const Discord = require('discord.js');
const fs = require('fs');
const _ = require('lodash');

const config = require('../res/config.json');
const CONSTANTS = require('./constants.js');
const domGame = require('./dominionsGame.js');

const STATUS_REGEX = /^Status for '(?<GAME_NAME>.*)'$/;
const TURN_REGEX = /turn (?<TURN>-?\d+), era (?<ERA>\d+), mods (?<MODS>\d+), turnlimit (?<TURN_LIMIT>\d+)/;
const NATION_REGEX = /^Nation\t(?<NATION_ID>\d+)\t(?<PRETENDER_ID>\d+)\t(?<PLAYER_STATUS>\d)\t(?<AI_DIFFICULTY>\d)\t(?<TURN_STATE>\d)\t(?<STRING_ID>\w*)\t(?<NAME>[^\t]*)\t(?<TITLE>[^\t]*)/;

const staleNotifcations = {};

function parseLines(lines){
    const gameState = {
        name: "",
        turnState: {},
        playerStatus: [],
    };

    for(line of lines){
        if(NATION_REGEX.test(line)){
            const groups = line.match(NATION_REGEX).groups;
            gameState.playerStatus.push({
                nationId: Number(groups.NATION_ID),
                pretenderId: Number(groups.PRETENDER_ID),
                stringId: groups.STRING_ID,
                aiDifficulty: Number(groups.AI_DIFFICULTY),
                playerStatus: CONSTANTS.PLAYER_STATUS[groups.PLAYER_STATUS],
                name: groups.NAME,
                title: groups.TITLE,
                turnState: CONSTANTS.TURN_STATE[groups.TURN_STATE],
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

function createEmbeddedGameState(game, gameState){
    const fields = [];
    let activeNames = [];
    let activePlayers = [];
    let activeState = [];

    let activePlayerCount = 0;

    const addRecord = (s) => {
        if(gameState.turnState.turn >= 0 && s.playerStatus.id == 0){
            return;
        }
        activeNames.push(`[${s.nationId}] ${s.name}`);

        let playerName;
        if(s.aiDifficulty > 0){
            playerName = CONSTANTS.AI_DIFFICULTY[s.aiDifficulty];
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

        if(s.playerStatus.id == 1){
            activeState.push(s.turnState.display);
        }else{
            activeState.push('-');
        }
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

    let desc = [];

    desc.push(`Hosted at: ${config.HOST_URL}`);
    desc.push(`Port: ${game.settings.server.port}\n`);

    if(gameState.turnState.turn < 0){
        desc.push("Lobby");
    } else{
        desc.push(`Turn: ${gameState.turnState.turn}`);
        if(game.state.nextTurnStartTime){
            desc.push(`Auto Host at: ${game.state.nextTurnStartTime}`);
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

function read(path, cb){
    console.log('reading ' + path)
    fs.readFile(path, 'utf8', (err, data) => {
        if(err){
            console.warn(err);
        }else{
            cb(data.split('\n'));
        } 
    });
}

function bindUpdateGameStatus(msg, filePath, game){
    return () => {
        console.info(`updating ${game.name}`);
        read(filePath, (lines) => {
            let currentTurnState = parseLines(lines);
            if(game.state.turn != currentTurnState.turnState.turn && currentTurnState.turnState.turn > 0){
                game.state.turn = currentTurnState.turnState.turn;
                if(game.settings.turns.maxTurnTime){
                    game.state.nextTurnStartTime = new Date().addHours(game.settings.turns.maxTurnTime);
                }
                domGame.pingPlayers(game, `Start of turn ${game.state.turn}`,
                    (m) => {
                        domGame.saveGame(game);
                    });
            }
            msg.edit(createEmbeddedGameState(game, currentTurnState));
        });
    }
}

function watchStatusFile(filePath, game){
    console.info(`Setting up watch for ${game.name}`);
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

function startWatches(game) {
    const filePath = `${config.DOMINION_SAVE_PATH}${game.name}/statusdump.txt`;
    if(!game.discord.turnStateMessageId){
        read(filePath, (lines) => {
            const embeddedMessage = createEmbeddedGameState(game, parseLines(lines));
            game.getChannel(c => {
                c.send(embeddedMessage).then(msg => {
                    game.discord.turnStateMessageId = msg.id;
                    domGame.saveGame(game);
                    watchStatusFile(filePath, game);
                });
            });
        });
    }else{
        watchStatusFile(filePath, game);
    }
}

module.exports = {
    parseLines,
    createEmbeddedGameState,
    startWatches
}