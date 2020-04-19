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

function createEmbeddedGameState(game, gameState){
    const fields = [];
    let activeNames = [];
    let activePlayers = [];
    let activeState = [];

    const addRecord = (s) => {
        if(gameState.turnState.turn >= 0 && s.playerStatus.id == 0){
            return;
        }
        
        activeNames.push(`[${s.nationId}] ${s.name}`);

        let playerName;
        if(s.aiDifficulty > 0){
            playerName = CONSTANTS.AI_DIFFICULTY[s.aiDifficulty];
        }else{
            playerName = game.getDisplayName(s.nationId);
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
    fs.readFile(path, 'utf8', (err, data) => {
        if(err){
            console.warn(err);
        }else{
            cb(data.split('\n'));
        } 
    });
}

function watchStatusFile(filePath, game){
    console.info(`Setting up watch for ${game.name}`);
    game.getChannel(c => {
        console.info(c);
        c.messages.fetch(game.discord.turnStateMessageId)
            .then( msg =>{
                let update = () => {
                    console.info(`updating ${game.name}`);
                    read(filePath, (lines) => {
                        let currentTurnState = parseLines(lines);
                        msg.edit(createEmbeddedGameState(game, currentTurnState));
                        if(game.state.turn != currentTurnState.turnState.turn){
                            game.state.turn = currentTurnState.turnState.turn
                            domGame.pingPlayers(game, `Start of turn ${game.state.turn}`,
                                (m) => {
                                    domGame.saveGame(game)
                                });
                        }
                    });
                }
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