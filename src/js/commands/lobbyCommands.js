
const lobbiesByChannelId = {};

function canHandle(msg){
    return lobbiesByChannelId[msg.channel.id] != undefined;
}

function handle(msg, cmd, arg){
    console.info(`Handling Lobby Command ${msg.id} ${cmd} ${arg}`);
}

module.exports = {
    canHandle,
    handle
}