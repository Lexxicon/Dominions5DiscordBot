const _ = require('lodash');
const fs = require('fs');

const EMOJI = require('./constants.js').EMOJI;

const fsPromises = fs.promises;

const EMOJI_REGEX = {};

for(k in EMOJI){
    EMOJI_REGEX[k] = new RegExp(_.escapeRegExp(k), 'gi')
}

function emoji(input){
    for(k in EMOJI){
        input = input.replace(EMOJI_REGEX[k], EMOJI[k]);
    }
    return input;
}

function pickRandom(array){
    return array[Math.floor(Math.random() * array.length)];
}

function toSavePath(name){
    name = name.endsWith('.json') ? name : `${name}.json`;
    return `${process.env.BOT_SAVE_PATH}${name}`;
}

function makeId(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function exists(name) {
    const result = await fsPromises.stat(toSavePath(name)).catch( err => {
        if(err && err.code == 'ENOENT') return false;
        throw err;
    })

    return result ? true : false;
}

async function loadFile(name) {
    let data = await fsPromises.readFile(toSavePath(name));
    let json = JSON.parse(data);
    return json;
}

async function saveFile(name, data) {
    return fsPromises.writeFile(toSavePath(name), JSON.stringify(data));
}

module.exports = {
    emoji,
    pickRandom,
    exists,
    loadFile,
    saveFile,
    makeId
}