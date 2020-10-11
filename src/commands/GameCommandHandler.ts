import { getLogger } from 'log4js';
import { Game, getGameByChannel, getGames } from '../DominionsGame';
import { GuildMessage } from '../global';
import { checkPermission, Permission } from '../Permissions';
import _ from "lodash";
import { Message } from 'discord.js';
import Util from '../Util';
import { CommandLocation, GeneralCommand } from './CommandHandler';

const log = getLogger();

export abstract class GameCommand extends GeneralCommand {
    async execute(msg: Message, args: string): Promise<number>{
        if(!Util.isGuildMessage(msg)) return -1;
        const game = getGameByChannel(msg.channel);
        if(!game) return -1;

        return await this.executeGameCommand(msg, game, args);
    }

    getCommandType(){
        return CommandLocation.GAME_LOBBY;
    }

    abstract getNeededPermission(): Permission;
    abstract getName(): string[];
    abstract getPath(): string;
    abstract executeGameCommand(msg: GuildMessage, game: Game, args: string): Promise<number>;
}
