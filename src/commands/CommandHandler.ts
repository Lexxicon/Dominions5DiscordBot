import { Channel, DMChannel, Message, NewsChannel, TextChannel } from "discord.js";
import { getChannel, getGameByChannel } from "../DominionsGame";
import { checkPermission, Permission } from "../Permissions";
import _ from 'lodash';

export enum CommandLocation {
    ANYWHERE        = ~0,
    DIRECT_MESSAGE  = 1 << 1,
    SERVER_LOBBY    = 1 << 2,
    GAME_LOBBY      = 1 << 3,
    GNERIC          = 1 << 4,
}

const registry:{[type in CommandLocation]:{[index: string]: GeneralCommand}} = {};

const channelTypeValues:number[] = [];
for(const type in CommandLocation){
    const value = CommandLocation[type];
    if(typeof value === 'number'){
        channelTypeValues.push(value);
    }
    registry[value] = {};
}


export const loadingErrors:string[] = [];

function getChannelType(channel: TextChannel | DMChannel | NewsChannel){
    if(channel.type == 'dm') return CommandLocation.DIRECT_MESSAGE;
    if(channel.name.toLowerCase() == process.env.DEFAULT_LOBBY_NAME?.toLowerCase()) return CommandLocation.SERVER_LOBBY;
    if(channel.parent && channel.parent.name.toLowerCase() == process.env.DEFAULT_GAMES_CATEGORY_NAME?.toLowerCase()) return CommandLocation.GAME_LOBBY;
    return CommandLocation.GNERIC;
}

export abstract class GeneralCommand {
    constructor(){
        for(const name of this.getName()){
            for(const type of channelTypeValues){
                if((this.getCommandType() & type) != type) continue;

                if(registry[type][name]){
                    loadingErrors.push(`Duplicate command! ${type} ${this.getName()} ${this.getPath()}`);
                }
                registry[type][name] = this;
            }
        }
    }

    abstract execute(msg: Message, args: string): Promise<number>
    abstract getCommandType(): CommandLocation
    abstract getNeededPermission(): Permission;
    abstract getName(): string[];
    abstract getPath(): string;
}

export async function processCommand(msg: Message, input: string){
    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;
    const channelType = getChannelType(msg.channel);

    const commandKey = input.substring(0, split);
    const command = registry[channelType][commandKey];
    if(!command){
        if(commandKey == 'help'){
            await msg.channel.send(`Available Commands:\n${_.keys(registry[channelType]).join('\n')}`);
            return 0;
        }
        return -1;
    } 

    const arg = split >= input.length ? '' : input.substring(split + 1);
    const game = getGameByChannel(msg.channel);
    checkPermission(msg.author, msg.member, command.getNeededPermission(), game);
    const result = await command.execute(msg, arg);
    return result;
}