import { Guild } from "discord.js";
import { getLogger } from "log4js";
import { ERA } from "../../Constants";
import { create, hostGame } from "../../DominionsGame";
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
        return Permission.HOST;
    }
    getCommandType() {
        return CommandLocation.SERVER_LOBBY;
    }
    getName(): string[] {
        return ['hostGame', 'host'];
    }
    getPath(): string {
        return __filename;
    }

    async execute(msg: GuildMessage, arg: string): Promise<number> {
        const gameName = Util.generateName();
        log.info(`Creating ${gameName}`);
    
        log.info(`Creating channel`);
        const channel = await createChannel(msg.channel.guild, `${gameName}`, `Created by request of ${msg.author.username}`);
        if(!channel) throw `Failed to create game ${gameName}`;
    
        log.info(`Creating game`);
        const game = create(channel, gameName);
        if(ERA[arg]) game.settings.setup.era = arg as Era;
        const guild: Guild = msg.guild;
    
        const playerRole = await guild.roles.create({
            data: {
                name:`${gameName}-player`,
                mentionable: true
            }
        });
        
        game.discord.playerRoleId = playerRole.id;
        const adminRole = await msg.guild.roles.create({
            data: {
                name: `${gameName}-admin`,
                mentionable: true
            }
        });
    
        await msg.member.roles.add(adminRole);
    
        game.discord.adminRoleId = adminRole.id;
        log.info(`Saving game`);
        await Util.saveJSON(game.name, game);
        log.info(`Hosting game`);
        await hostGame(game);

        await new Promise(r => setTimeout(r, 2000));

        await startWatches(game);
        await Util.saveJSON(game.name, game);
        await msg.channel.send(`Created new game ${channel.toString()}`);
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