const log = require("log4js").getLogger();

import { Guild } from 'discord.js';
import { create, hostGame } from './DominionsGame';
import * as status from './DominionsStatus';
import { GuildMessage } from './global';
import util from './Util';

const GAMES_CATEGORY_NAME = process.env.DEFAULT_GAMES_CATEGORY_NAME!;
const LOBBY_NAME = `${process.env.DEFAULT_LOBBY_NAME}`.toLowerCase();

function createChannel(guild: Guild, name: string, reason: string, cb){
    name = name.toLowerCase();
    log.info('Create channel ' + name);
    if (name === LOBBY_NAME) {
        log.warn('Can\'t create the lobby!');
        return;
    }

    if(util.findChannel(guild, name)){
        log.warn('Channel already exists!');
        return;
    }

    const category = util.findChannel(guild, GAMES_CATEGORY_NAME);
    guild.channels.create(name, {
        type: 'text',
        parent: category?.id,
        reason: reason
    })
    .then(cb)
    .catch(log.error);
}

function deleteChannel(guild: Guild, name: string, reason: string){
    name = name.toLowerCase().replace(' ', '-');

    log.info('delete ' + name);
    if (name === LOBBY_NAME) {
        log.warn('Can\'t delete the lobby!');
        return;
    }

    let channel = util.findChannel(guild, name);
    if (!channel) {
        log.warn(`Failed to find channel: ${name}`)
        return;
    }

    const category = util.findChannel(guild, GAMES_CATEGORY_NAME);
    if (channel.parent !== category) {
        log.warn(`Can\'t delete channels not in the game category! ${channel.name}`);
        return;
    } 
    
    log.info(`About to delete ${channel}`);
    channel.delete(reason);
}

function createNewGame(msg: GuildMessage, era: any){
    let gameName = util.generateName();
    log.info(`Creating ${gameName}`);

    log.info(`Creating channel`);
    createChannel(msg.channel.guild, `${gameName}`, `Created by request of ${msg.author.username}`, (c) => {
        log.info(`Creating game`);
        let game = create(c, gameName, msg.client);

        if(era) game.settings.setup.era = era;
        game.discord.gameLobbyChannelId = c.id;
        const guild: Guild = msg.guild;

        guild.roles.create({
            data: {
                name:`${gameName}-player`,
                mentionable: true
            }
        }).then(r => {
            game.discord.playerRoleId = r.id;
            return msg.guild.roles.create({
                data: {
                    name: `${gameName}-admin`,
                    mentionable: true
                }
            })
        }).then(r => {
            game.discord.adminRoleId = r.id;
            log.info(`Saving game`);
            util.saveJSON(game.name, game);
            log.info(`Hosting game`);
            hostGame(game);
            setTimeout(() => {
                log.info(`Watching game`);
                status.startWatches(game);
                util.saveJSON(game.name, game);
            }, 3000);
        }).catch(err => {
            log.error(err);
            throw err;
        });
    });
}

let pingMsgs = {};

function handleCommand(msg: GuildMessage): number{
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
            createNewGame(msg, arg);
            break;
        case 'delete':
            deleteChannel(msg.guild, arg, `Deleted by request of ${msg.author.username}`);
            break;
        case 'roles':
            msg.guild.roles.fetch()
                .then(role => {
                    log.info(role);
                    log.info(`There are ${role.cache.size} roles.`);
                });
            break;
        case 'ping':
            msg.channel.send(`<@${msg.author.id}>`);
        default:
            log.warn(`unsupported command! ${command}`);
            return -1;
    }
    return 0;
}

export = handleCommand;