import { GuildMember, User } from "discord.js";
import { Game } from "./DominionsGame";
import { getLogger } from "log4js";

const log = getLogger();

export enum Permission {
    ANY         = 0,
    MASTER      = ~0,
    PLAYER      = 1 << 1,
    GAME_ADMIN  = 1 << 2 | PLAYER,
    HOST        = 1 << 3,
}

function hasGameRole(member: GuildMember | null, game?: Game, roleID?: string | null){
    if(!game || !roleID || !member) return false;
    return (game && game.discord.playerRoleId && member.roles.cache.find( role => role.id == roleID) !== null);
}

function hasGuildRole(member: GuildMember | null, roleID?: string){
    return member && roleID && member.roles.cache.find((role) => role.name == roleID) !== undefined;
}

export function getPermissions(member: GuildMember | null, game?: Game){
    let permission = Permission.ANY;

    if(hasGameRole(member, game, game?.discord?.playerRoleId))  permission = permission | Permission.PLAYER;
    if(hasGameRole(member, game, game?.discord?.adminRoleId))   permission = permission | Permission.GAME_ADMIN;
    if(hasGuildRole(member, process.env.DEFAULT_GAME_HOST))     permission = permission | Permission.HOST;
    if(hasGuildRole(member, process.env.DEFAULT_GAME_MASTER))   permission = permission | Permission.MASTER;

    return permission;
}

export function checkPermission(user: User, member: GuildMember | null, neededPermission: Permission, game?: Game){
    return (neededPermission & getPermissions(member, game)) == neededPermission;
}