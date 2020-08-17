const config = require("../res/config.json");
const util = require('./util.js');
const status = require('./dominionsStatus.js');
const domGame = require('./dominionsGame.js');

const GAMES_CATEGORY_NAME = config.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME.toLowerCase();

function createChannel(guild, name, reason, cb){
    name = name.toLowerCase();
    console.info('create ' + name);
    if (name === LOBBY_NAME) {
        console.warn('Can\'t create the lobby!');
        return;
    }

    if(util.findChannel(guild, name)){
        console.warn('Channel already exists!');
        return;
    }

    const category = util.findChannel(guild, GAMES_CATEGORY_NAME);
    guild.channels.create(name, {
        type: 'text',
        parent: category.id,
        reason: reason
    }).then(cb);
}

function deleteChannel(guild, name, reason){
    name = name.toLowerCase().replace(' ', '-');

    console.info('delete ' + name);
    if (name === LOBBY_NAME) {
        console.warn('Can\'t delete the lobby!');
        return;
    }

    let channel = util.findChannel(guild, name);
    if (!channel) {
        console.warn(`Failed to find channel: ${name}`)
        return;
    }

    const category = util.findChannel(guild, GAMES_CATEGORY_NAME);
    if (channel.parent !== category) {
        console.warn(`Can\'t delete channels not in the game category! ${channel.name}`);
        return;
    } 
    
    console.info(`About to delete ${channel}`);
    channel.delete(reason);
}

function createNewGame(msg){
    let gameName = util.generateName();
    console.info(`Creating ${gameName}`);

    console.info(`Creating channel`);
    createChannel(msg.channel.guild, `${gameName}-state`, `Created by request of ${msg.author.username}`, (channel) => {
        console.info(`Creating game`);
        let game = domGame.create(channel, gameName, msg.client);
        createChannel(msg.channel.guild, `${gameName}-lobby`, `Created by request of ${msg.author.username}`, (c) => {
            game.discord.gameLobbyChannelId = c.id;
            game.save();
        });
        msg.guild.roles.create({
            data: {
                name:`${gameName}-player`,
                mentionable: true
            }
        }).then(r => {
            game.discord.playerRoleId = r.id;
        }).catch(err => {
            console.error(err);
            throw err;
        });
        console.info(`Saving game`);
        util.saveJSON(game.name, game);
        console.info(`Hosting game`);
        domGame.hostGame(game);
        setTimeout(() => {
            console.info(`Watching game`);
            status.startWatches(game);
            util.saveJSON(game.name, game);
        }, 3000);
    });
}

let pingMsgs = {};

function handleCommand(msg){
    if(!msg.member.roles.cache.find(r => r.name === "Dominions Master")){
        return
    }
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);
    switch (command) {
        case 'host':
            createNewGame(msg);
            break;
        case 'delete':
            deleteChannel(msg.guild, arg, `Deleted by request of ${msg.author.username}`);
            break;
        case 'ping':
            msg.channel.send('ping <@&699768621496533102>').then(sent => {
                if(pingMsgs[sent.channel.id]){
                    pingMsgs[sent.channel.id].delete();
                }
                pingMsgs[sent.channel.id] = sent;
            })

            break;
        case 'roles':
            msg.guild.roles.fetch()
                .then(role => {
                    console.info(role);
                    console.log(`There are ${role.cache.size} roles.`);
                });
            break;
        default:
            console.warn(`unsupported command! ${command}`);
            return -1;
    }
    return 0;
}

module.exports = handleCommand;