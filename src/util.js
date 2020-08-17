const fs = require("fs");
const _ = require("lodash");
const config = require("../res/config.json");
const EMOJI = require('./constants.js').EMOJI;

const EMOJI_REGEX = {};

for(k in EMOJI){
    EMOJI_REGEX[k] = new RegExp(_.escapeRegExp(k), 'gi')
}

fs.mkdirSync(config.BOT_SAVE_PATH, {recursive: true}, (err) => {
    if (err) throw err;
});


function domcmd (commands, game, cb = null) {
    const path = config.DOMINION_SAVE_PATH + game.name + '/domcmd';
    fs.writeFile(path, commands, (err) => {
        if(err && game.discord.channel) {
            game.discord.channels.send('Error while executing dom command! Check logs for more details');
            console.warn(`Error while executing dom command for ${game.name}! \n\n ${err}`);
        }

        if(cb){
            cb();
        }
    });
}

function emoji(input){
    for(k in EMOJI){
        input = input.replace(EMOJI_REGEX[k], EMOJI[k]);
    }
    return input;
}

function saveJSON(name, data){
    fs.writeFile(`${config.BOT_SAVE_PATH}${name}.json`, JSON.stringify(data), err => {
        if(err) throw err;
        console.log(`Saved ${name}`);
    });
}

function loadJSON(name, cb){
    name = name.endsWith('.json') ? name : `${name}.json`;
    console.info(`loading ${name}`);
    fs.readFile(`${config.BOT_SAVE_PATH}${name}`, (err, data) => {
        if(err) cb(data, err);
        else {
            let json = JSON.parse(data);
            console.info(`loaded ${json} from ${data}`);
            cb(json);
        }
    });
}

function loadAllGames(cb){
    fs.readdir(config.BOT_SAVE_PATH, (e, items)=>{
        if(e) {
            throw e;
        }
        items.forEach(cb);
    });
}

function randomValue(array){
    return array[Math.floor(Math.random() * array.length)];
}

function generateName(){
    for(let i = 0; i < 30; i++){
        let name = randomValue(config.GAME_NAME_PREFIX)+'-'+randomValue(config.GAME_NAME_SUFFIX);
        if(!fs.existsSync(`${config.DOMINION_MODS_PATH}${name}`)){
            return name;
        }
    }
    throw new 'Failed to create valid name after 30 tries';
}

function getSeconds(str) {
    let seconds = 0;
    let days = str.match(/(\d+)\s*d/);
    let hours = str.match(/(\d+)\s*h/);
    let minutes = str.match(/(\d+)\s*m/);
    if (days) { seconds += parseInt(days[1])*86400; }
    if (hours) { seconds += parseInt(hours[1])*3600; }
    if (minutes) { seconds += parseInt(minutes[1])*60; }
    return seconds;
  }

module.exports = {
    findChannel: function (guild, name) {
        return guild.channels.cache.find(c => c.name === name);
    },
    domcmd: {
        startGame: function(game, seconds = 15, cb = null){
            domcmd(`settimeleft ${seconds}`, game, cb);
        }
    },
    emoji,
    saveJSON,
    loadJSON,
    generateName,
    loadAllGames,
    getSeconds
};