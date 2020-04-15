const Discord = require('discord.js');
const fs = require('fs');
const _ = require('lodash');

const config = require('../res/config.json');
const CONSTANTS = require('./constants.js');
const domGame = require('./dominionsGame.js');

const STATUS_REGEX = /^Status for '(?<GAME_NAME>.*)'$/;
const TURN_REGEX = /turn (?<TURN>-?\d+), era (?<ERA>\d+), mods (?<MODS>\d+), turnlimit (?<TURN_LIMIT>\d+)/;
const NATION_REGEX = /^Nation\t(?<NATION_ID>\d+)\t(?<PRETENDER_ID>\d+)\t(?<PLAYER_STATUS>\d)\t(?<AI_DIFFICULTY>\d)\t(?<TURN_STATE>\d)\t(?<STRING_ID>\w*)\t(?<NAME>[^\t]*)\t(?<TITLE>[^\t]*)/;


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
                nationId: groups.NATION_ID,
                pretenderId: groups.PRETENDER_ID,
                stringId: groups.STRING_ID,
                aiDifficulty: CONSTANTS.AI_DIFFICULTY[groups.AI_DIFFICULTY],
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
                turn: groups.TURN,
                era: groups.ERA,
                mods: groups.MODS,
                turnLimit: groups.TURN_LIMIT
            };
        }
    }

    gameState.playerStatus = _.sortBy(gameState.playerStatus, o => o.nationId);

    return gameState;
}

function createEmbeddedGameState(gameState){
    const fields = [];
    let activeNames = [];
    let activePlayers = [];
    let activeState = [];

    const addRecord = (s) => {
        activeNames.push(s.name);
        activePlayers.push(s.playerStatus.display);

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

    let desc;

    if(gameState.turnState.turn < 0){
        desc = "Lobby"
    } else{
        desc = `Turn: ${gameState.turnState.turn}`;
    }

    const embeddedMessage = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Game State for: ${gameState.name}`)
        .setDescription(desc)
        .addFields(
            fields
        );

    return embeddedMessage;
}

function read(path, cb){
    fs.readFile(path, 'utf8', (err, data) => {
        if(err){
            console.warn(err);
        }else{
            cb(data.split('\n'));
        } 
    });
}

function watchStatusFile(filePath, game){
    game.getChannel(c => {
        c.messages.fetch(game.discord.turnStateMessageId).then(
            msg =>{
                fs.watch(filePath, 'utf8', (event, file) => {
                    console.info(`updating ${game.name}`);
                    read(filePath, (lines) => {
                        currentTurnState = parseLines(lines);
                        msg.edit(createEmbeddedGameState(currentTurnState));
                    });
                });

            }
        );
    });
}

function startWatches(game) {
    const filePath = `${config.DOMINION_SAVE_PATH}${game.name}/statusdump.txt`;
    
    if(!game.discord.turnStateMessageId){
        read(filePath, (lines) => {
            const embeddedMessage = createEmbeddedGameState(parseLines(lines));
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