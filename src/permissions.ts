import { GuildMember } from "discord.js";
import { getLogger } from "log4js";
import { Game } from "./dominionsGame";

const log = getLogger();

export enum Permission {
    ANY,
    PLAYER,
    GAME_ADMIN,
    MASTER
}

export function checkPermission(member: GuildMember, neededPermission: Permission, game?: Game){
    switch(neededPermission){
        default:
            log.warn(`Unbound permission! ${neededPermission}`)
            throw `Need permission ${neededPermission}`;

        case Permission.ANY: return true;
        case Permission.PLAYER:
            if(game && game.discord.playerRoleId && member?.roles.resolve(game.discord.playerRoleId) !== null){
                return true;
            }
            //fall through
        case Permission.GAME_ADMIN:
            if(game && game.discord.adminRoleId && member?.roles.resolve(game.discord.adminRoleId) !== null){
                return true;
            }
            //fall through
        case Permission.MASTER:
            if(member?.roles.cache.find((role) => role.name == process.env.DEFAULT_GAME_MASTER) !== undefined){
                return true;
            }
            throw `Need permission ${neededPermission}`;
    }
}