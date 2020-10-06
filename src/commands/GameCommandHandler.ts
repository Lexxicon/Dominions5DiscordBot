

import { getLogger } from 'log4js';
import { Game, getGameByChannel, getGames } from '../DominionsGame';
import { GuildMessage } from '../global';
import { checkPermission, Permission } from '../Permissions';
import _ from "lodash";
import { Message } from 'discord.js';
import Util from '../Util';

const log = getLogger();

const registry:{[index: string]: GameCommand} = {};
const loadingErrors:string[] = [];

export abstract class GameCommand implements GeneralCommand {
    
    public get value() : {} {
        return registry;
    }

    constructor(){
        for(let name of this.getName()){
            if(registry[name]){
                loadingErrors.push(`Duplicate command! ${this.getName()} ${this.getPath()}`);
            }else{
                log.debug(`Registered ${name}`);
                this.value[name] = this;
            }
        }
    }

    async execute(msg: Message, args: string): Promise<Number>{
        if(!Util.isGuildMessage(msg)) return -1;
        let game = getGameByChannel(msg.channel);
        if(!game) return -1;

        return this.executeGameCommand(msg, game, args);
    }

    abstract getNeededPermission(): Permission;
    abstract getName(): string[];
    abstract getPath(): string;
    abstract executeGameCommand(msg: GuildMessage, game: Game, args: string): Promise<number>;
}

export interface GeneralCommand {
    execute(msg: Message, args: string): Promise<Number>
}

export async function processGameCommand(msg: GuildMessage){
    
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const commandKey = input.substring(0, split);
    const command = registry[commandKey];
    if(!command){
        if(commandKey == 'help')
        await msg.channel.send(`Available Commands:\n${_.keys(registry).join('\n')}`);
        return 0;
    } 

    const arg = split >= input.length ? '' : input.substring(split + 1);

    let games = getGames();
    for(let gameKey in games){
        let game = games[gameKey];

        if(msg.channel.id != game.discord.channelId){
            continue;
        }
        checkPermission(msg.member, command.getNeededPermission(), game);
        return command.executeGameCommand(msg, game, arg);
    }
    return -1;
}
