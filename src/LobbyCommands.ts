import { Guild } from 'discord.js';
import { getLogger } from 'log4js';
import { create, hostGame } from './DominionsGame';
import * as status from './DominionsStatus';
import { GuildMessage } from './global';
import util from './Util';

const log =getLogger();
const GAMES_CATEGORY_NAME = process.env.DEFAULT_GAMES_CATEGORY_NAME!;
const LOBBY_NAME = `${process.env.DEFAULT_LOBBY_NAME}`.toLowerCase();

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

async function deleteChannel(guild: Guild, name: string, reason: string){
    name = name.toLowerCase().replace(' ', '-');

    log.info('delete ' + name);
    if (name === LOBBY_NAME) {
        log.warn('Can\'t delete the lobby!');
        return;
    }

    const channel = guild.channels.cache.find(channel => channel.name == name);
    if (!channel) {
        log.warn(`Failed to find channel: ${name}`);
        return;
    }

    const category = guild.channels.cache.find(channel => channel.name == GAMES_CATEGORY_NAME);
    if (channel.parent !== category) {
        log.warn(`Can't delete channels not in the game category! ${channel.name}`);
        return;
    } 
    
    log.info(`About to delete ${channel}`);
    return await channel.delete(reason);
}

async function createNewGame(msg: GuildMessage, era: any){
    const gameName = util.generateName();
    log.info(`Creating ${gameName}`);

    log.info(`Creating channel`);
    const channel = await createChannel(msg.channel.guild, `${gameName}`, `Created by request of ${msg.author.username}`);
    if(!channel) throw `Failed to create game ${gameName}`;

    log.info(`Creating game`);
    const game = create(channel, gameName);

    if(era) game.settings.setup.era = era;
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
    await util.saveJSON(game.name, game);
    log.info(`Hosting game`);
    await hostGame(game);
    setTimeout(async () => {
        log.info(`Watching game`);
        await status.startWatches(game);
        await util.saveJSON(game.name, game);
    }, 3000);
}

async function handleCommand(msg: GuildMessage): Promise<number>{
    if(!msg.member.roles.cache.find(r => r.name === "Dominions Master")){
        return -1;
    }
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);
    switch (command) {
        case 'host':
            await createNewGame(msg, arg);
            break;
        case 'delete':
            await deleteChannel(msg.guild, arg, `Deleted by request of ${msg.author.username}`);
            break;
        case 'roles':
            await msg.guild.roles.fetch()
                .then(role => {
                    log.info(role);
                    log.info(`There are ${role.cache.size} roles.`);
                });
            break;
        case 'ping':
            await msg.channel.send(`<@${msg.author.id}>`);
            break;
        default:
            log.warn(`unsupported command! ${command}`);
            return -1;
    }
    return 0;
}

export = handleCommand;