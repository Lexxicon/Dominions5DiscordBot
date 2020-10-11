import { Guild } from "discord.js";
import { getLogger } from "log4js";
import { ERA } from "../../Constants";
import { create, getPorts, hostGame } from "../../DominionsGame";
import { startWatches } from "../../DominionsStatus";
import { Era, GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { CommandLocation, GeneralCommand } from "../CommandHandler";

const GAMES_CATEGORY_NAME = process.env.DEFAULT_GAMES_CATEGORY_NAME!;
const LOBBY_NAME = `${process.env.DEFAULT_LOBBY_NAME}`.toLowerCase();

const log = getLogger();

new class extends GeneralCommand{
    getNeededPermission(): Permission {
        return Permission.ANY;
    }
    getCommandType() {
        return CommandLocation.SERVER_LOBBY;
    }
    getName(): string[] {
        return ['capacity'];
    }
    getPath(): string {
        return __filename;
    }

    async execute(msg: GuildMessage, arg: string): Promise<number> {
        const ports = getPorts();
        let count = 0;
        let total = 0;
        for(const port in ports){
            total++;
            if(ports[port] == null){
                count++;
            }
        }

        await msg.channel.send(`Available slots ${count}/${total}`);
        return 0;
    }
};



async function createChannel(guild: Guild, name: string, reason: string){
    name = name.toLowerCase();
    log.info('Create channel ' + name);
    if (name === LOBBY_NAME) {
        log.warn('Can\'t create the lobby!');
        return;
    }
    
    if(guild.channels.cache.find(channel => channel.name == name)){
        log.warn('Channel already exists!');
        return;
    }

    const category = guild.channels.cache.find(channel => channel.name == GAMES_CATEGORY_NAME);
    return await guild.channels.create(name, {
        type: 'text',
        parent: category?.id,
        reason: reason
    });
}