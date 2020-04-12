// Status for '<game_name>'
// turn 38, era 1, mods 0, turnlimit 0
// Nation  6       6       2       3       0       early_ermor     Ermor   New Faith
// Nation  13      13      1       0       0       early_abysia    Abysia  Children of Flame
// Nation  25      25      2       2       0       early_kailasa   Kailasa Rise of the Ape Kings
// Nation  27      27      1       0       2       early_yomi      Yomi    Oni Kings
// Nation  37      37      2       2       0       early_rlyeh     R'lyeh  Time of Aboleths
// Nation  5       5       0       0       9       early_arcoscephale      Arcoscephale    Golden Era



// ['Nation', nation_ID, pretender_ID, player_status, AI_difficulty, turn_state, string_id, nation_name, nation_title]

const Discord = require('discord.js');
const fs = require('fs');
const _ = require('lodash');

const config = require('../res/config.json');
const CONSTANTS = require('./constants.js');

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
    _.filter(gameState.playerStatus, s => s.playerStatus.canBlock).forEach(addRecord);
    _.filter(gameState.playerStatus, s => !s.playerStatus.canBlock).forEach(addRecord);

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
    })

    const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Game State for: ${gameState.name}`)
        .setDescription(`Turn: ${gameState.turnState.turn}`)
        .addFields(
            fields
        );

    return exampleEmbed;
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

function startWatches(game) {
    const filePath = `${config.DOMINION_SAVE_PATH}${game.name}/statusdump.txt`;
    read(filePath, (lines) => {
        const embed = createEmbeddedGameState(parseLines(lines));

        game.discord.channel.send(embed).then(msg => {
            fs.watch(filePath, 'utf8', (event, file) => {
                console.info(`updating ${game.name}`);
                read(filePath, (lines) => {
                    msg.edit(createEmbeddedGameState(parseLines(lines)));
                });
            });
        });
    });
}

module.exports = {
    parseLines,
    createEmbeddedGameState,
    startWatches
}