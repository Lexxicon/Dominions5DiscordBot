const fs = require("fs");
const _ = require("lodash");
const config = require("../res/config.json");
const EMOJI = require('./constants.js').EMOJI;

const EMOJI_REGEX = {};

for(k in EMOJI){
    EMOJI_REGEX[k] = new RegExp(_.escapeRegExp(k), 'gi')
}

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
    fs.writeFile(`${config.BOT_SAVE_PATH}${name}`, JSON.stringify(data), err => {
        if(err) throw err;
        console.log(`Saved ${name}`);
    });
}

function loadJSON(name, cb){
    fs.readFile(`${config.BOT_SAVE_PATH}${name}`, (err, data) => {
        if(err) cb(data, err);
        else cb(JSON.parse(data));
    });
}

module.exports = {
    findChannel: function (guild, name) {
        return guild.channels.cache.find(c => c.name === name);
    },
    domcmd: {
        startGame: function(game, cb = null){
            domcmd('settimeleft 15', game, cb);
        }
    },
    emoji,
    saveJSON,
    loadJSON
};