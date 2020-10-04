

import { getLogger } from 'log4js';
import { Game, getGames } from '../DominionsGame';
import { GuildMessage } from '../global';
import { checkPermission, Permission } from '../Permissions';
import _ from "lodash";

const log = getLogger();

const registry:{[index: string]: GameCommand} = {};
const loadingErrors:string[] = [];

export abstract class GameCommand {
    
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

    abstract getNeededPermission(): Permission;
    abstract getName(): string[];
    abstract getPath(): string;
    abstract async execute(msg: GuildMessage, game: Game, args: string): Promise<number>;
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
        return -1;
    } 

    const arg = split >= input.length ? '' : input.substring(split + 1);

    let games = getGames();
    for(let gameKey in games){
        let game = games[gameKey];

        if(msg.channel.id != game.discord.channelId){
            continue;
        }
        checkPermission(msg.member, command.getNeededPermission(), game);
        return command.execute(msg, game, arg);
    }
    return -1;
}
