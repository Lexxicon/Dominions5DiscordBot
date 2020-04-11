const config = require("../res/config.json");
const util = require('./util.js');
const status = require('./dominionsStatus.js');

const GAMES_CATEGORY_NAME = config.GAMES_CATEGORY_NAME;
const LOBBY_NAME = config.LOBBY_NAME.toLowerCase();

function createChannel(guild, name, reason){
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
    });
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

function handleCommand(msg){
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);
    switch (command) {
        case 'create':
            createChannel(msg.guild, arg, `Created by request of ${msg.author.username}`);
            break;
        case 'delete':
            deleteChannel(msg.guild, arg, `Deleted by request of ${msg.author.username}`);
            break;
        case 'start':
            util.domcmd.startGame({name: arg});
            break;
        case 'watch': 
            status.startWatches({name: arg, discord:{channel:msg.channel}});
            break;
        default:
            console.warn(`unsupported command! ${command}`);
            break;
    }
}

module.exports = handleCommand;