

const loadedGames = {}
const gamesByChannelId = {};

function canHandle(msg){
    return gamesByChannelId[msg.channel.id] != undefined;
}

function handle(msg, cmd, arg){
    console.info(`Handling Game Command ${msg} ${cmd} ${arg}`);
}

module.exports = {
    canHandle,
    handle
}