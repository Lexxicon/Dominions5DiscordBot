import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import AsciiTable from 'ascii-table';
import AsciiChart from 'asciichart';
import Util from "../../Util";
import { GeneralCommand, CommandLocation } from "../CommandHandler";

const log = getLogger();

new class extends GeneralCommand{
    getNeededPermission(): Permission {
        return Permission.MASTER;
    }
    getCommandType() {
        return ~ (CommandLocation.DIRECT_MESSAGE | CommandLocation.GAME_LOBBY| CommandLocation.SERVER_LOBBY);
    }
    getName(): string[] {
        return ['init'];
    }
    getPath(): string {
        return __filename;
    }

    async execute(msg: GuildMessage, arg: string): Promise<number> {
        if(!msg.guild){
            return -1;
        }
        const roles = await msg.guild.roles.fetch();
        if(roles.cache.filter( (v) => v.name == `${process.env.DEFAULT_GAME_MASTER}`).size == 0){
            log.info(`Configuring ${msg.guild?.name}`);
            const role = await roles.create({
                    data:{
                        name: `${process.env.DEFAULT_GAME_MASTER}`
                    }
                });
            log.info(`adding role`);
            await msg.member.roles.add(role);
            
            log.info(`creating category`);
            const category = await msg.guild?.channels.create(`${process.env.DEFAULT_GAMES_CATEGORY_NAME}`, {
                    type: 'category'
                });
    
            log.info(`creating lobby`);
            await category.guild.channels.create(`${process.env.DEFAULT_LOBBY_NAME}`, {
                parent: category
            });
        }
        return 1;
    }
};