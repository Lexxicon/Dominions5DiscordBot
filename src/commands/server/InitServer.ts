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
        log.info(`Configuring ${msg.guild?.name}`);
        if(roles.cache.filter( (v) => v.name == `${process.env.DEFAULT_GAME_MASTER}`).size == 0){
            const role = await roles.create({
                    data:{
                        name: `${process.env.DEFAULT_GAME_MASTER}`
                    }
                });
            log.info(`adding GM role`);
            await msg.member.roles.add(role);
        }
        if(roles.cache.filter( (v) => v.name == `${process.env.DEFAULT_GAME_HOST}`).size == 0){
            const role = await roles.create({
                    data:{
                        name: `${process.env.DEFAULT_GAME_HOST}`
                    }
                });
            log.info(`adding host role`);
            await msg.member.roles.add(role);
        }
        let category = msg.guild.channels.cache.find(channel => channel.name == `${process.env.DEFAULT_GAMES_CATEGORY_NAME}`);
        if(!category){
            log.info(`creating category`);
            category = await msg.guild?.channels.create(`${process.env.DEFAULT_GAMES_CATEGORY_NAME}`, {
                    type: 'category'
                });
        }
        if(msg.guild.channels.cache.find(channel => channel.name == `${process.env.DEFAULT_LOBBY_NAME}`) == null){
            log.info(`creating lobby`);
            await category.guild.channels.create(`${process.env.DEFAULT_LOBBY_NAME}`, {
                parent: category
            });
        }
        return 1;
    }
};