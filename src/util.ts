
import { DMChannel, Guild, Message, NewsChannel, TextChannel } from "discord.js";
import fs from "fs";
import _ from "lodash";
import * as constants from './constants.js';
import { GuildMessage } from "./global.js";
const log = require("log4js").getLogger();

const config = require('../res/config.json');

const ncp = require('ncp').ncp;

const EMOJI_REGEX = {};

for(let k in constants.EMOJI){
    EMOJI_REGEX[k] = new RegExp(_.escapeRegExp(k), 'gi')
}

fs.mkdirSync(`${process.env.BOT_SAVE_PATH}`, {recursive: true});
fs.mkdirSync(`${process.env.BOT_ARCHIVE_PATH}`, {recursive: true});
fs.mkdirSync(`${process.env.DOM5_CONF}`, {recursive: true});

function domcmd (commands: string, game, cb?: () =>void) {
    const path = `${process.env.DOM5_CONF}/savedgames/${game.name}/domcmd`;
    fs.writeFile(path, commands, (err) => {
        if(err && game.discord.channel) {
            game.discord.channels.send('Error while executing dom command! Check logs for more details');
            log.warn(`Error while executing dom command for ${game.name}! \n\n ${err}`);
        }

        if(cb){
            cb();
        }
    });
}

function emoji(input: string){
    for(let k in constants.EMOJI){
        input = input.replace(EMOJI_REGEX[k], constants.EMOJI[k]);
    }
    return input;
}

function saveJSON(name: string, data: any){
    fs.writeFile(`${process.env.BOT_SAVE_PATH}${name}.json`, JSON.stringify(data), 'utf8', err => {
        if(err) {
            log.error(err);
        }else{
            log.info(`Saved ${name}`);
        }
    });
}

function loadJSON(name: string, cb: (data: any, err?: Error) => void){
    name = name.endsWith('.json') ? name : `${name}.json`;
    log.info(`loading ${name}`);
    fs.readFile(`${process.env.BOT_SAVE_PATH}${name}`, 'utf8', (err, data) => {
        if(err) cb(data, err);
        else {
            try{
                let json = JSON.parse(data);
                cb(json);
            } catch (e) {
                log.error(`Error loading ${name}`);
                if (e instanceof SyntaxError) {
                    printError(e, true);
                } else {
                    printError(e, false);
                }
            }
        }
    });
}

function backupGame(name: string){
    const path = `${process.env.BOT_ARCHIVE_PATH}${name}`;

    let backupActions: any[] = [];

    let backups = Number(process.env.MAX_BACKUP);
    while(backups > 0){
        let i = --backups;
        backupActions.push((cb) => {
            log.debug(`delete ${path}_${i + 1}`);
            fs.rmdir(`${path}_${i + 1}`, {recursive: true}, cb);
        });
        backupActions.push((cb) => {
            log.debug(`cp ${path}_${i} -> ${path}_${i + 1}`);
            ncp(`${path}_${i}`, `${path}_${i + 1}`, cb);
        });
    }

    backupActions.push((cb) => {
        log.debug(`delete ${path}_${0}`);
        fs.rmdir(`${path}_${0}`, {recursive: true}, cb);
    });
    backupActions.push((cb) => {
        log.debug(`backing up save data ${process.env.DOM5_CONF}/savedgames/${name}`);
        ncp(`${process.env.DOM5_CONF}/savedgames/${name}`, `${path}_${backups}`, cb);
    });
    backupActions.push((cb) => {
        log.debug(`backing up bot data ${process.env.BOT_SAVE_PATH}${name}.json`);
        ncp(`${process.env.BOT_SAVE_PATH}${name}.json`, `${path}_${backups}/${name}.json`, cb);
    });

    backupActions.reverse();

    let callback = (err) => {
        if(err) { log.error(err)}
        let next = backupActions.pop();
        if(next){
            next(callback);
        }else{
            log.info(`backed up ${name}`);
        }
    };

    callback(null);
}

function printError (error: Error, explicit: boolean) {
    log.info(`[${explicit ? 'EXPLICIT' : 'INEXPLICIT'}] ${error.name}: ${error.message}, ${error.stack}`);
}

function deleteJSON(name: string) {
    fs.unlink(`${process.env.BOT_SAVE_PATH}${name}.json`, (err) => log.error(err));
}

function deleteGameSave(game) {
    const path = `${process.env.BOT_SAVE_PATH}${game.name}`;
    fs.rmdir(path, {recursive: true}, (err) => {if(err) { log.error(err)}});
}

function loadAllGames(cb: (gameFile: string)=>void){
    fs.readdir(`${process.env.BOT_SAVE_PATH}`, (e, items)=>{
        if(e) {
            throw e;
        }
        items.filter(v => v.endsWith('.json')).forEach(cb);
    });
}

function randomValue<T>(array: T[]): T{
    return array[Math.floor(Math.random() * array.length)];
}

function generateName(){
    for(let i = 0; i < 30; i++){
        let name = randomValue(config.GAME_NAME_PREFIX)+'-'+randomValue(config.GAME_NAME_SUFFIX);
        if(!fs.existsSync(`${process.env.DOM5_CONF}/savedgames/${name}`)){
            return name;
        }
    }
    throw 'Failed to create valid name after 30 tries';
}

function getSeconds(str: string) {
    if(str.startsWith('-')) throw `Negative times aren't allowed! ${str}`
    let seconds = 0;
    let days = str.match(/(\d+)\s*d/);
    let hours = str.match(/(\d+)\s*h/);
    let minutes = str.match(/(\d+)\s*m/);
    let rawSeconds = str.match(/(\d+)\s*s/);
    if (days) { seconds += parseInt(days[1])*86400; }
    if (hours) { seconds += parseInt(hours[1])*3600; }
    if (minutes) { seconds += parseInt(minutes[1])*60; }
    if (rawSeconds) { seconds += parseInt(rawSeconds[1]); }
    return seconds;
}

function getAvailableMods(cb: (files: string[]) => void){
    return fs.readdir(`${process.env.DOM5_CONF}/mods/`, 
    (err, files) => cb(files.filter(f => f.endsWith(".dm"))));
}

function getStaleNations(game, cb: (err: any, stales: string[]) => void) {
    let stales : string[] = [];
    let staleThreshold = game.settings.turns.maxTurnTime * game.settings.turns.maxHoldups;
    if(game.state.turn < 2) {
        cb(null, stales);
        return;
    }

    if(staleThreshold > 0){
        let staleTime = new Date(game.state.nextTurnStartTime);
        if(staleTime.getSecondsFromNow() < 0){
            log.debug(`Game hasn't started yet ${game.name}`)
            cb(null, []);
        }
        staleTime.addHours(-staleThreshold);
        staleTime.addHours(-game.settings.turns.maxTurnTime);

        fs.readdir(`${process.env.DOM5_CONF}/savedgames/${game.name}`, (err, files) => {
            if(files.length == 0){
                cb(err, stales);
                return;
            }
            let count = files.length;
            files.forEach(file => {
                if(file.endsWith('.2h')){
                    fs.stat(`${process.env.DOM5_CONF}/savedgames/${game.name}/${file}`, (err, stat) => {
                        if(stat && stat.ctime < staleTime){
                            stales.push(file.substr(0, file.indexOf('.2h')));
                        }
                        count--;
                        if(count == 0){
                            cb(err, stales);
                        }
                    });
                }else{
                    count--;
                    if(count == 0){
                        cb(err, stales);
                    }
                }
            })
        });
    }else{
        cb(null, stales);
    }
}

function isGuildMessage(message: Message): message is GuildMessage{
    if(message.member == null || message.guild == null || !(message.channel instanceof TextChannel || message.channel instanceof NewsChannel)){
        throw 'Not a guild message!'
    }
    return true;
}

export = {
    findChannel: function (guild: Guild, name: string) {
        return guild.channels.cache.find(c => c.name === name);
    },
    domcmd: {
        startGame: function(game, seconds = 15, cb?: () => void){
            domcmd(`settimeleft ${seconds}`, game, cb);
        }
    },
    emoji,
    saveJSON,
    loadJSON,
    deleteJSON,
    deleteGameSave,
    generateName,
    loadAllGames,
    getSeconds,
    getAvailableMods,
    getStaleNations,
    backupGame,
    isGuildMessage
};