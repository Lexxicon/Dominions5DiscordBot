
import { Message, NewsChannel, TextChannel } from "discord.js";
import fs from "fs";
import _, { floor, random } from "lodash";
import { getLogger } from 'log4js';
import { ncp } from 'ncp';
import * as constants from './Constants';
import { Game } from './DominionsGame';
import { PlayerStatus } from "./DominionsStatus";
import { GuildMessage } from "./global";

const log = getLogger();

const config = require('../res/config.json');
const tips:string[] = require('../res/tips.json').tips;

const EMOJI_REGEX = {};

for(const k in constants.EMOJI){
    EMOJI_REGEX[k] = new RegExp(_.escapeRegExp(k), 'gi');
}

fs.mkdirSync(`${process.env.BOT_SAVE_PATH}`, {recursive: true});
fs.mkdirSync(`${process.env.BOT_ARCHIVE_PATH}`, {recursive: true});
fs.mkdirSync(`${process.env.DOM5_CONF}`, {recursive: true});

async function domcmd (commands: string, game: Game) {
    const path = `${process.env.DOM5_CONF}/savedgames/${game.name}/domcmd`;
    try{
        await fs.promises.writeFile(path, commands);
    }catch(err){
        log.warn(`Error while executing dom command for ${game.name}! \n\n ${err}`);
    }
}

function emoji(input: string){
    for(const k in constants.EMOJI){
        input = input.replace(EMOJI_REGEX[k], constants.EMOJI[k]);
    }
    return input;
}

async function saveJSON(name: string, data: any){
    try{
        await fs.promises.writeFile(`${process.env.BOT_SAVE_PATH}${name}.json`, JSON.stringify(data));
        log.info(`Saved ${name}`);
    }catch(err){
        log.error(err);
    }
}

async function loadJSON(name: string){
    name = name.endsWith('.json') ? name : `${name}.json`;
    log.info(`loading ${name}`);
    try{
        const data = await fs.promises.readFile(`${process.env.BOT_SAVE_PATH}${name}`, 'utf8');
        return JSON.parse(data);
    }catch(err){
        log.error(`Error loading ${name}`);
        if (err instanceof SyntaxError) {
            printError(err, true);
        } else {
            printError(err, false);
        }
    }
}

async function backupGame(name: string){
    const path = `${process.env.BOT_ARCHIVE_PATH}${name}`;

    const backupActions: any[] = [];

    let backups = Number(process.env.MAX_BACKUP);
    while(backups > 0){
        const i = --backups;
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

    const callback = (err: NodeJS.ErrnoException[]|null) => {
        if(err) { 
            for(const e of err){
                if(e.code != 'ENOENT'){
                    log.error(JSON.stringify(err)); 
                }
            }
        }
        const next = backupActions.pop();
        if(next){
            next(callback);
        }else{
            log.info(`backed up ${name}`);
        }
    };

    await callback(null);
}

function printError (error: Error, explicit: boolean) {
    log.info(`[${explicit ? 'EXPLICIT' : 'INEXPLICIT'}] ${error.name}: ${error.message}, ${error.stack}`);
}

function guessStatus(input: any, nations: PlayerStatus[]){
    if(isNaN(input)){
        let bestGuess: PlayerStatus | null = null;
        const reg = /[.,/#!$%^&*;:{}=\-_'`~() ]/g;
        input = (input as string).normalize('NFD').toLocaleLowerCase().replace(reg,"").trim();
        for(let i = 0; i < nations.length; i++){
            const status = nations[i];
            if(status == null) continue;
            const nationName = status.name.normalize('NFD').toLocaleLowerCase().replace(reg,"");
            log.debug(`${input} vs ${nationName}`);
            if(nationName == input){
                return status;
            }
            if(nationName.startsWith(input)){
                bestGuess = status;
            }

            if(bestGuess == null && nationName.includes(input)){
                bestGuess = status;
            }
        }
        return bestGuess;
    }else{
        const i = Number(input);
        if(nations[i].nationId == i){
            return nations[i];
        }
        for(const status of nations){
            if(status.nationId == i){
                return status;
            }
        }
    }
    return null;
}

async function deleteJSON(name: string) {
    try{
        await fs.promises.unlink(`${process.env.BOT_SAVE_PATH}${name}.json`);
        log.debug(`Deleted json ${name}`);
    }catch(err){
        log.error(err);
    }
}

async function deleteGameSave(game) {
    const path = `${process.env.DOM5_CONF}/savedgames/${game.name}`;
    try{
        await fs.promises.rmdir(path, {recursive: true});
        log.debug(`Deleted game ${game.name} at ${path}`);
    }catch(err){
        log.error(err);
    }
}

async function deletePretender(game:Game, nation:string) {
    try{
        if(game.state.turn > 0) throw `Can't delete pretenders after a game has started!`;
        await fs.promises.unlink(`${process.env.DOM5_CONF}/savedgames/${game.name}/${nation}.2h`);
    }catch(err){
        log.error(err);
    }
}

async function loadAllGames(){
    const items = await fs.promises.readdir(`${process.env.BOT_SAVE_PATH}`);
    return items.filter(v => v.endsWith('.json'));
}

function randomValue<T>(array: T[]): T{
    return array[Math.floor(Math.random() * array.length)];
}

function generateName(){
    for(let i = 0; i < 30; i++){
        const name = randomValue(config.GAME_NAME_PREFIX)+'-'+randomValue(config.GAME_NAME_SUFFIX);
        if(!fs.existsSync(`${process.env.DOM5_CONF}/savedgames/${name}`)){
            return name;
        }
    }
    throw 'Failed to create valid name after 30 tries';
}

const SEC_IN_MIN = 60;
const SEC_IN_HOUR = SEC_IN_MIN * 60;
const SEC_IN_DAY = SEC_IN_HOUR * 24;

function getSeconds(str: string) {
    if(str.startsWith('-')) throw `Negative times aren't allowed! ${str}`;
    let seconds = 0;
    const days = str.match(/(\d+)\s*d/);
    const hours = str.match(/(\d+)\s*h/);
    const minutes = str.match(/(\d+)\s*m/);
    const rawSeconds = str.match(/(\d+)\s*s/);
    if (days) { seconds += parseInt(days[1])*SEC_IN_DAY; }
    if (hours) { seconds += parseInt(hours[1])*SEC_IN_HOUR; }
    if (minutes) { seconds += parseInt(minutes[1])*SEC_IN_MIN; }
    if (rawSeconds) { seconds += parseInt(rawSeconds[1]); }
    return seconds;
}



const MINUTE_THRESHOLD = getSeconds('2m');
const HOUR_THRESHOLD = getSeconds('2h');
const DAYS_THRESHOLD = getSeconds('2d');

function getDisplayTime(seconds: number){
    const mapper = (unit: number) => Math.floor(seconds/unit);

    if(seconds > DAYS_THRESHOLD){
        return `${mapper(SEC_IN_DAY)} days`;
    }
    if(seconds > HOUR_THRESHOLD){
        return `${mapper(SEC_IN_HOUR)} hours`;
    }
    if(seconds > MINUTE_THRESHOLD){
        return `${mapper(SEC_IN_MIN)} minutes`;
    }
    return `${mapper(1)} seconds`;
}

async function getAvailableMods(){
    const files = await fs.promises.readdir(`${process.env.DOM5_CONF}/mods/`);
    return files.filter(f => f.endsWith(".dm"));
}

async function getStaleNations(game: Game) {
    const stales : string[] = [];
    const staleThreshold = game.settings.turns.maxTurnTimeMinutes * game.settings.turns.maxHoldUps;
    if(game.state.turn < 2) {
        return stales;
    }

    if(staleThreshold > 0){
        const staleTime = new Date(game.state.nextTurnStartTime);
        if(staleTime.getSecondsFromNow() < 0){
            log.debug(`Game hasn't started yet ${game.name}`);
            return stales;
        }
        staleTime.addMinutes(-staleThreshold);
        staleTime.addMinutes(-game.settings.turns.maxTurnTimeMinutes);

        try{
            const files = await fs.promises.readdir(`${process.env.DOM5_CONF}/savedgames/${game.name}`);

            if(files.length == 0){
                return stales;
            }
            for(const file of files){
                if(file.endsWith('.2h')){
                    try{
                        const stat = await fs.promises.stat(`${process.env.DOM5_CONF}/savedgames/${game.name}/${file}`);
                        if(stat && stat.ctime < staleTime){
                            stales.push(file.substr(0, file.indexOf('.2h')));
                        }
                    }catch(e){
                        log.error(`Erro getting stats ${e}`);
                    }
                }
            }
        }catch(err){
            log.error(err);
        }
    }
    return stales;
}

function isGuildMessage(message: Message): message is GuildMessage{
    if(message.member == null || message.guild == null || !(message.channel instanceof TextChannel || message.channel instanceof NewsChannel)){
        throw 'Not a guild message!';
    }
    return true;
}

function getRandomTip(): string{
    return tips[floor(random(tips.length))];
}

export = {
    domcmd: {
        raw: (game:Game, arg: any) => { return domcmd(arg, game);},
        startGame: (game, seconds = 15) => {
            return domcmd(`settimeleft ${seconds}`, game);
        },
        setQuickHost: (game:Game, quickHost: boolean)=>{
            return domcmd(`setquickhost ${quickHost ? 1 : 0}`, game);
        },
        setInterval: (game:Game, interval: number)=>{
            return domcmd(`setinterval ${interval}`, game);
        },
        setPause: async (game:Game, pause: boolean)=>{
            for(let i = 0; i < 7; i++){
                await domcmd(`setpause ${i} ${pause ? 1 : 0}`, game);
            }
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
    isGuildMessage,
    getDisplayTime,
    deletePretender,
    guessStatus,
    getRandomTip
};